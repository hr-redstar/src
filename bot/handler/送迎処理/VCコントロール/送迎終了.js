const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
      if (dispatchData.status === 'finished' || dispatchData.status === 'completed') {
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

      // --- ステータス更新 & ログ記録 ---
      // updatedData には精算情報を付与して保存
      const updatedData = await updateDispatchProgress({
        guild,
        rideId,
        status: 'COMPLETED',
        updates: {
          endTime: timeStr,
          completedAt: now.toISOString(),
          fee: usageFee,
          settledCredit: newCredit,
          target: destinationInput // 目的地を更新
        }
      });

      // --- DM送信 (利用者・送迎者) ---
      const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
      const driverId = dispatchData.driverId;

      try {
        const userMember = await guild.members.fetch(userId).catch(() => null);
        if (userMember) {
          const userDmEmbed = buildPanelEmbed({
            title: '🏁 送迎が完了しました',
            description: 'ご利用ありがとうございました。利用料の精算が完了しました。\n\n**※ 次回ご利用時に合算・精算されます**',
            color: 0x2ecc71,
            client: client,
            fields: [
              { name: '利用料', value: `￥${usageFee.toLocaleString()}`, inline: true },
              { name: '現在のクレジット残高', value: `￥${newCredit.toLocaleString()}`, inline: true }
            ]
          });
          await userMember.send({ embeds: [userDmEmbed] }).catch(() => null);
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
                  .setCustomId('driver|return_queue') // v2.9.2 新フロー
                  .setLabel('待機列に戻る')
                  .setStyle(ButtonStyle.Success)
              )
            ]
          }).catch(() => null);
        }
      } catch (e) { console.error('DM送信失敗(Driver)', e); }

      // --- 後処理 (表示更新) ---
      const newComponents = interaction.message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(c => {
          c.setDisabled(true);
          if (c.customId === interaction.customId) {
            c.setLabel('送迎完了').setStyle(ButtonStyle.Secondary);
          }
        });
        return newRow;
      });

      await interaction.editReply({ components: newComponents });

      // 公開用 終了サマリー送信 (v2.9.2)
      const { buildRideEmbed } = require('../../../utils/ログ/buildRideEmbed');
      const finalEmbed = buildRideEmbed({ status: 'COMPLETED', data: updatedData.data || updatedData });

      await interaction.channel.send({
        content: [
          '送迎が終了しました。',
          '※１週間で削除されます。',
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

      // 送迎回数カウントアップ
      const driverData = await loadDriver(guildId, driverId);
      if (driverData) {
        driverData.rideCount = (driverData.rideCount || 0) + 1;
        await store.writeJson(paths.driverProfileJson(guildId, driverId), driverData);
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
