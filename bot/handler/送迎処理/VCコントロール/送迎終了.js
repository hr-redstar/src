// handler/送迎処理/VCコントロール/送迎終了.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { loadConfig } = require('../../../utils/設定/設定マネージャ');
const { loadDriver } = require('../../../utils/driversStore');
const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');
const { updateVcState } = require('../../../utils/vcStateStore');

/**
 * 送迎終了ボタンハンドラー (v2.9.0)
 * ・送迎者のみ実行可能
 * ・利用料の自動精算とデータ更新
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const sub = parsed?.params?.sub;
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    if (interaction.isButton() && !sub) {
      return this.showDestinationModal(interaction, rideId);
    }

    if (interaction.isModalSubmit() && sub === 'submit') {
      return this.handleModalSubmit(interaction, client, rideId);
    }
  },

  /**
   * 目的地入力モーダルを表示
   */
  async showDestinationModal(interaction, rideId) {
    try {
      // 1. データ取得
      const guildId = interaction.guildId;
      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.reply({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      // 2. 権限ガード (送迎者のみ)
      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.reply({
          content: '❌ この操作は送迎担当者のみ実行できます。',
          flags: 64
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`ride|end|sub=submit&rid=${rideId}`)
        .setTitle('送迎終了');

      const input = new TextInputBuilder()
        .setCustomId('destination')
        .setLabel('最終目的地 (必須)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('例: 〇〇ビル、△△駅前')
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    } catch (error) {
      console.error('送迎終了モーダル表示エラー:', error);
      await interaction.reply({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  },

  /**
   * モーダル送信後の本処理
   */
  async handleModalSubmit(interaction, client, rideId) {
    try {
      await interaction.deferUpdate();

      const guildId = interaction.guildId;
      const destinationInput = interaction.fields.getTextInputValue('destination');

      // 1. データ取得
      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      // 2. 権限ガード (送迎者のみ)
      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.followUp({
          content: '❌ この操作は送迎担当者のみ実行できます。',
          flags: 64
        });
      }

      // 3. ステータスガード (二重終了防止)
      const { RideStatus } = require('../../../utils/constants');
      if (dispatchData.status === RideStatus.COMPLETED || dispatchData.status === 'finished' || dispatchData.status === 'completed') {
        return interaction.followUp({
          content: '⚠️ この送迎は既に終了しています。',
          flags: 64
        });
      }

      const guild = interaction.guild;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // --- 利用料計算 & 精算 ---
      const config = await loadConfig(guildId);
      const feeString = config.usageFee || '0';
      const usageFee = parseInt(feeString.replace(/[^0-9]/g, '')) || 0;

      // ユーザーデータ取得 & クレジット更新
      const userId = dispatchData.userId;
      const userPath = paths.userProfileJson(guildId, userId);
      const userData = await store.readJson(userPath, { userId: userId }).catch(() => ({ userId }));

      const currentCredit = userData.credits || 0;
      const newCredit = currentCredit - usageFee;

      // 更新保存
      userData.credits = newCredit;
      userData.lastUsageFee = usageFee;
      userData.lastRideAt = now.toISOString();
      await store.writeJson(userPath, userData);

      // 取引履歴の記録 (メイン利用者)
      const { logCreditTransaction } = require('../../../utils/creditHistoryStore');
      await logCreditTransaction(guildId, userId, {
        amount: -usageFee,
        type: 'ride_fee',
        reason: `送迎利用料 (ID: ${rideId.substring(0, 8)})`,
        balance: userData.credits
      }).catch(() => null);

      // --- ステータス更新 & ログ記録 ---
      const totalPassengers = 1 + (dispatchData.carpoolUsers?.length || 0);
      const totalRevenue = usageFee * totalPassengers;

      // updatedData には精算情報を付与して保存 (メイン利用者分)
      const updatedData = await updateDispatchProgress({
        guild,
        rideId,
        status: RideStatus.COMPLETED,
        updates: {
          endTime: timeStr,
          completedAt: now.toISOString(),
          fee: usageFee, // メイン利用者単体の料金
          totalRevenue: totalRevenue, // 案件全体の売上
          settledCredit: newCredit,
          target: destinationInput // 目的地を更新
        }
      });

      // --- DM用共通Embedビルダー (v2.9.5) ---
      const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
      const createFinishDmEmbed = (title, fee, balance) => buildPanelEmbed({
        title,
        description: [
          `今回の利用料: **￥${fee.toLocaleString()}**`,
          `現在の残高: **￥${balance.toLocaleString()}**`,
          '',
          'ご利用ありがとうございました。',
          'またのご利用をお待ちしております。'
        ].join('\n'),
        color: 0x2ecc71,
        client: client
      });

      // --- 相乗り利用者の精算処理 ---
      if (dispatchData.carpoolUsers && dispatchData.carpoolUsers.length > 0) {
        for (const cpUser of dispatchData.carpoolUsers) {
          try {
            const cpUserId = cpUser.userId;
            const cpUserPath = paths.userProfileJson(guildId, cpUserId);
            const cpUserData = await store.readJson(cpUserPath, { userId: cpUserId }).catch(() => ({ userId: cpUserId }));

            const oldCpCredit = cpUserData.credits || 0;
            const newCpCredit = oldCpCredit - usageFee;

            cpUserData.credits = newCpCredit;
            cpUserData.lastUsageFee = usageFee;
            cpUserData.lastRideAt = now.toISOString();
            await store.writeJson(cpUserPath, cpUserData);

            // 取引履歴の記録 (相乗り利用者)
            await logCreditTransaction(guildId, cpUserId, {
              amount: -usageFee,
              type: 'carpool_fee',
              reason: `相乗り利用料 (ID: ${rideId.substring(0, 8)})`,
              balance: cpUserData.credits
            }).catch(() => null);

            // 相乗り者へのDM通知
            const cpMember = await guild.members.fetch(cpUserId).catch(() => null);
            if (cpMember) {
              const cpDmEmbed = createFinishDmEmbed('✅ 相乗り完了・精算報告', usageFee, newCpCredit);
              await cpMember.send({ embeds: [cpDmEmbed] }).catch(() => null);

              // 残高不足アラート通知 (v2.9.2)
              if (newCpCredit < 500) {
                const alertEmbed = buildPanelEmbed({
                  title: '⚠️ クレジット残高不足の警告',
                  description: `現在の残高が **￥${newCpCredit.toLocaleString()}** となっています。\n残高が不足すると次回の配車依頼ができなくなりますので、早めのチャージをお願いいたします。`,
                  color: 0xe67e22,
                  client: client
                });
                await cpMember.send({ embeds: [alertEmbed] }).catch(() => null);
              }
            }
          } catch (cpErr) {
            console.error(`相乗り者(${cpUser.userId})の精算エラー:`, cpErr);
          }
        }
      }

      // --- 全体送迎履歴 (Global History) への記録 ---
      try {
        const { globalRideHistoryJson } = paths;
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const d = now.getDate();
        const historyPath = globalRideHistoryJson(guildId, y, m, d);

        const historyList = await store.readJson(historyPath, {}).catch(() => ({}));
        historyList[rideId] = {
          rideId,
          userId,
          driverId: dispatchData.driverId,
          ...updatedData,
          carpoolUsers: dispatchData.carpoolUsers || [],
          totalRevenue: totalRevenue,
          completedAt: now.toISOString(),
          timestamp: dispatchData.startedAt || now.toISOString(), // 開始時刻ベースでの日付管理
        };
        await store.writeJson(historyPath, historyList);
      } catch (e) {
        console.error('全体履歴保存エラー:', e);
      }

      // --- DM送信 (利用者・送迎者) ---
      const driverId = dispatchData.driverId;

      try {
        const userMember = await guild.members.fetch(userId).catch(() => null);
        if (userMember) {
          const userDmEmbed = createFinishDmEmbed('✅ 送迎完了・精算報告', usageFee, newCredit);
          await userMember.send({ embeds: [userDmEmbed] }).catch(() => null);

          // 残高不足アラート通知 (v2.9.2)
          if (newCredit < 500) {
            const alertEmbed = buildPanelEmbed({
              title: '⚠️ クレジット残高不足の警告',
              description: `現在の残高が **￥${newCredit.toLocaleString()}** となっています。\n残高が不足すると次回の配車依頼ができなくなりますので、早めのチャージをお願いいたします。`,
              color: 0xe67e22,
              client: client
            });
            await userMember.send({ embeds: [alertEmbed] }).catch(() => null);
          }
        }
      } catch (e) { console.error('DM送信失敗(User)', e); }

      // 完了通知 (本人にのみ ephemeral) (v2.9.2)
      await interaction.followUp({
        content: `※送迎終了：<@${interaction.user.id}> (${timeStr})`,
        flags: 64
      });

      try {
        const driverMember = await guild.members.fetch(driverId).catch(() => null);
        if (driverMember) {
          const driverDmEmbed = buildPanelEmbed({
            title: '✅ 送迎完了・精算報告',
            description: [
              '送迎が完了しました。',
              '利用料の精算処理が完了しています。',
              '',
              'ご対応ありがとうございました。',
              '',
              '送迎者は以下の「待機列に戻る」ボタンから次の仕事を待つことができます。',
              'このVCチャンネルは一定期間経過後に自動的に削除されます。'
            ].join('\n'),
            color: 0x3498db,
            client: client
          });

          await driverMember.send({
            embeds: [driverDmEmbed],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId(`driver|return_queue|gid=${guildId}`) // v2.9.2 新フロー (ギルドID込)
                  .setLabel('待機列に戻る')
                  .setStyle(ButtonStyle.Success)
              )
            ]
          }).catch(() => null);
        }
      } catch (e) { console.error('DM送信失敗(Driver)', e); }

      // --- 後処理 (表示更新) ---
      // v2.9.2: 1つのメッセージ（既存のEmbed更新）で完結させる
      const { buildRideEmbed } = require('../../../utils/ログ/buildRideEmbed');
      const finalEmbed = buildRideEmbed({ status: 'COMPLETED', data: updatedData.data || updatedData });

      await interaction.editReply({
        content: [
          '送迎が終了しました。',
          '※１週間でこのプライベートVCは削除されます。',
          '落とし物等の連絡で期間延長をしたい場合は、『期間延長』を押して下さい。'
        ].join('\n'),
        embeds: [finalEmbed],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ride|control|sub=extend')
              .setLabel('期間延長')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });

      // --- VCステート更新 (削除スケジュールの設定) ---
      const DAY = 1000 * 60 * 60 * 24;
      await updateVcState(guildId, interaction.channel.id, {
        endedAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + DAY * 7).toISOString(),
      });

      // 送迎回数カウントアップ & 最終降車地点保存 & 報酬記録
      const driverProfilePath = paths.driverProfileJson(guildId, driverId);
      const driverData = await store.readJson(driverProfilePath).catch(() => null);
      if (driverData) {
        // Double-nested current structure support
        const d = driverData.current || driverData;
        d.rideCount = (d.rideCount || 0) + 1;
        d.totalEarnings = (d.totalEarnings || 0) + totalRevenue;
        d.lastDropOffLocation = destinationInput;

        await store.writeJson(driverProfilePath, driverData);
      }

      // 統計情報の更新 (Revenue)
      const { incrementStat } = require('../../../utils/ストレージ/統計ストア');
      await incrementStat(guildId, 'revenue', totalRevenue).catch(() => null);
      await incrementStat(guildId, 'rides', 1).catch(() => null);
      if (totalPassengers > 1) {
        await incrementStat(guildId, 'carpool_rides', 1).catch(() => null);
      }

      // ファイル削除はすぐには行わない（ログ用に残す、あるいは定期クリーンアップに任せる）
      // ただし `active` からは外す処理が必要かも？
      // 現状の仕様では `status: COMPLETED` にしておけばOK

    } catch (error) {
      console.error('送迎終了エラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
