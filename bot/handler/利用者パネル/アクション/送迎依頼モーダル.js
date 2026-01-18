// handler/利用者パネル/アクション/送迎依頼モーダル.js
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { loadConfig } = require('../../../utils/設定/設定マネージャ');
const { popNextDriver } = require('../../../utils/配車/待機列マネージャ');
const { formatDateShort } = require('../../../utils/共通/日付フォーマット');

const { updateVcState } = require('../../../utils/vcStateStore');
const { findUserMemoChannel } = require('../../../utils/findUserMemoChannel');
const { createUserMemoChannel } = require('../../../utils/createUserMemoChannel');

const updateRideListPanel = require('../../送迎処理/一覧パネル更新');
const { updateUserPanel } = require('../メイン');
const { updateDriverPanel } = require('../../送迎パネル/メイン');

const interactionTemplate = require('../../共通/interactionTemplate');
const { ACK } = interactionTemplate;

module.exports = async function (interaction, client, parsed) {
  return interactionTemplate(interaction, {
    ack: ACK.REPLY,
    async run(interaction) {
      const guild = interaction.guild;
      const guildId = guild.id;
      const userId = interaction.user.id;

      // 入力値取得
      const address = interaction.fields.getTextInputValue('input|ride|address');
      const mark = interaction.fields.getTextInputValue('input|ride|mark');
      const destination = interaction.fields.getTextInputValue('input|ride|to');

      const sub = parsed?.params?.sub;
      const rideId = `${Date.now()}_${userId}`;

      // ゲストモード判定
      const isGuest = sub === 'guest_modal';
      // タイトル・タイプ設定
      const typeLabel = isGuest ? 'ゲスト送迎依頼' : '送迎依頼';

      // 1. マッチング処理（待機列からドライバー取得）
      const driverData = await popNextDriver(guildId);

      if (!driverData) {
        await interaction.editReply({
          content:
            '⚠️ 申し訳ありません、現在待機中の送迎車がいません。\nしばらく待ってから再度お試しください。',
        });
        return;
      }

      const driverId = driverData.userId;
      const driverPlace = driverData.stopPlace || '不明';

      // 2. プライベートVC作成
      const config = await loadConfig(guildId);
      const parentId = config.categories?.privateVc;
      let vcChannel = null;

      if (parentId) {
        const now = new Date();
        // 月/日 形式
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dateStr = `${month}/${day}`;
        // HHmm 形式
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const timeStr = `${hours}${minutes}`;

        // フォーマット: 月/日 HH:mm~--:-- 【送迎者現在地】→【目印】→【目的地】
        const channelName = `${dateStr} ${hours}:${minutes}~--:-- 【${driverPlace}】→【${mark}】→【${destination}】`;

        try {
          vcChannel = await guild.channels.create({
            name: channelName.substring(0, 100), // 100文字制限
            type: ChannelType.GuildVoice,
            parent: parentId,
            permissionOverwrites: [
              {
                id: guild.id,
                deny: [PermissionFlagsBits.ViewChannel],
              },
              {
                id: driverId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                ],
              },
              {
                id: userId,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak,
                ],
              },
              // Bot自身も見えるように
              {
                id: interaction.client.user.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
              },
            ],
          });

          // VCにコントロールパネルメッセージを送信
          if (vcChannel) {
            const {
              EmbedBuilder,
              ActionRowBuilder,
              ButtonBuilder,
              ButtonStyle,
            } = require('discord.js');
            const matchTime = `${hours}:${minutes}`;
            const controlEmbed = new EmbedBuilder()
              .setTitle(channelName.substring(0, 256))
              .setDescription(
                `送迎者：<@${driverId}>　利用者：<@${userId}>\n` +
                `マッチング時間：${matchTime}　向かっています：--:--\n\n` +
                `送迎者　送迎開始時間：--:-- ｜ 送迎終了時間：--:--\n` +
                `利用者　送迎開始時間：--:-- ｜ 送迎終了時間：--:--`
              )
              .setColor(0x3498db)
              .setTimestamp();

            const controlButtons = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ride|approach|rid=${rideId}`)
                .setLabel('向かっています')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🚗'),
              new ButtonBuilder()
                .setCustomId(`ride|start|rid=${rideId}`)
                .setLabel('送迎開始')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🚀'),
              new ButtonBuilder()
                .setCustomId(`ride|end|rid=${rideId}`)
                .setLabel('送迎終了')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('✅')
            );

            const ctrlMsg = await vcChannel.send({ embeds: [controlEmbed], components: [controlButtons] });
            dispatchData.vcMessageId = ctrlMsg.id;

            // 利用中一覧に登録
            const userInUsePath = paths.userInUseListJson(guildId);
            const usersInUse = await store.readJson(userInUsePath, []).catch(() => []);
            if (!usersInUse.includes(userId)) {
              usersInUse.push(userId);
              await store.writeJson(userInUsePath, usersInUse);
            }
          }

          // 個人メモへのログ転送設定
          if (vcChannel) {
            try {
              const memoCategoryId = config.categories?.userMemo;
              if (memoCategoryId) {
                // 1. 利用者のメモチャンネルを探す（なければ作成）
                let memoChannel = await findUserMemoChannel({
                  guild,
                  userId,
                  categoryId: memoCategoryId,
                  role: 'user',
                });

                if (!memoChannel) {
                  const user = await interaction.client.users.fetch(userId).catch(() => null);
                  if (user) {
                    memoChannel = await createUserMemoChannel({
                      guild,
                      user,
                      categoryId: memoCategoryId,
                      role: 'user',
                    });
                  }
                }

                if (memoChannel) {
                  // 2. ログ用スレッドを作成
                  const now = new Date();
                  const yearMonth = `${now.getFullYear()}/${now.getMonth() + 1}`;
                  const threadName = `${yearMonth} 【${driverPlace}】→【${mark}】→【${destination}】`;

                  const thread = await memoChannel.threads
                    .create({
                      name: threadName.substring(0, 100),
                      autoArchiveDuration: 10080, // 1週間
                      reason: '送迎チャットログ用',
                    })
                    .catch(console.error);

                  if (thread) {
                    // 3. VC状態を保存 (messageCreateで参照)
                    await updateVcState(guildId, vcChannel.id, {
                      userId,
                      driverId,
                      memoChannelId: memoChannel.id,
                      logThreadId: thread.id,
                      route: `【${driverPlace}】→【${mark}】→【${destination}】`,
                    });
                  }
                }
              }
            } catch (err) {
              console.error('メモログ設定エラー:', err);
            }
          }
        } catch (e) {
          console.error('VC作成失敗', e);
        }
      }


      // 3. 送迎ステータス保存 (Active Dispatch)
      const dispatchData = {
        rideId,
        userId,
        driverId,
        driverPlace, // 追加: 相乗り募集で表示するため
        from: address, // 便宜上 address を from に
        mark: mark,
        destination: destination, // to
        status: 'dispatching', // 配車済
        vcId: vcChannel ? vcChannel.id : null,
        vcMessageId: null, // あとで保存
        matchTime: `${hours}:${minutes}`,
        startedAt: new Date().toISOString(),
        guest: isGuest,
      };

      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;

      // 送信したメッセージIDを保存
      if (vcChannel) {
        // 先程送信したメッセージを取得する必要があるが、vcChannel.send の戻り値を使う
        // run関数の構造上、メッセージ送信後にIDを取得して保存する
      }

      // 運営者ログの同期 (v1.7.0: MATCHED)
      const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
      await updateRideOperatorLog({
        guild: interaction.guild,
        rideId: rideId,
        status: 'MATCHED',
        data: {
          driverId: driverId,
          userId: userId,
          area: routeInfo,
          matchedAt: dispatchData.startedAt,
        }
      }).catch(() => null);

      await store.writeJson(activePath, dispatchData);

      // 相乗り募集開始 (非同期で実行)
      const { postCarpoolRecruitment } = require('../../../utils/配車/相乗りマネージャ');
      postCarpoolRecruitment(guild, dispatchData, interaction.client).catch(console.error);

      // 4. 個人メッセージ送信 (Embed)
      const vcLink = vcChannel
        ? `[プライベートVCはこちら](https://discord.com/channels/${guildId}/${vcChannel.id})`
        : 'VC作成失敗';

      // ルート情報を1行で表示
      const routeInfo = `【${driverPlace}】→【${mark}】→【${destination}】`;

      const embed = new EmbedBuilder()
        .setTitle(`🚕 ${typeLabel}`)
        .setDescription(
          `マッチングしました！\n送迎者は <@${driverId}> です。\n\n` +
          `${routeInfo}\n\n` +
          `**ボイスチャンネル**\n${vcLink}`
        )
        .setColor(0x00ff00)
        .setTimestamp();

      // 利用者へDM
      try {
        await interaction.user.send({ embeds: [embed] });
      } catch (e) {
        console.log('利用者へのDM送信失敗', e);
      }

      // ドライバーへDM
      try {
        const driverUser = await guild.members.fetch(driverId).catch(() => null);
        if (driverUser) {
          const driverEmbed = new EmbedBuilder()
            .setTitle(`🔔 新規${typeLabel}`)
            .setDescription(
              `新しい依頼が入りました！\n利用者は <@${userId}> です。\n\n` +
              `${routeInfo}\n\n` +
              `**ボイスチャンネル**\n${vcLink}`
            )
            .setColor(0xffa500)
            .setTimestamp();
          await driverUser.send({ embeds: [driverEmbed] });
        }
      } catch (e) {
        console.log('ドライバーへのDM送信失敗', e);
      }

      // 5. パネル更新
      await Promise.all([
        updateRideListPanel(guild, interaction.client),
        updateUserPanel(guild, interaction.client),
        updateDriverPanel(guild, interaction.client),
      ]).catch(console.error);

      // 6. 完了応答
      await interaction.editReply({
        content: `✅ [${driverPlace}]待機中の <@${driverId}> とマッチングしました。\nDMを確認して、プライベートVCに参加してください。\n\n🗑️ 依頼をキャンセルする場合は、VC内で調整するか、運営へ連絡してください。`,
      });
    },
  });
};
