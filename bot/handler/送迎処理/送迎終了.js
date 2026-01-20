// handler/送迎処理/送迎終了.js
const store = require('../../utils/ストレージ/ストア共通');
const updateRideListPanel = require('./一覧パネル更新');
const { updateDriverPanel } = require('../送迎パネル/メイン');

const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const { loadVcState, updateVcState } = require('../../utils/vcStateStore');
const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = async function (interaction, targetId) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.UPDATE,
    async run(interaction) {
      // 送迎終了処理
      const guildId = interaction.guildId;
      const driverId = interaction.user.id;

      const paths = require('../../utils/ストレージ/ストレージパス');
      const { onDutyDriversJson, globalRideHistoryJson } = paths;

      // このドライバーが担当している「active」な相乗り募集があれば終了させる
      const carpoolDir = paths.carpoolDir(guildId);

      try {
        const files = await store.listKeys(carpoolDir).catch(() => []);
        const jsonFiles = files.filter((f) => f.endsWith('.json'));
        for (const fileKey of jsonFiles) {
          const rideData = await store.readJson(fileKey).catch(() => null);
          if (rideData && rideData.driverId === driverId && rideData.status === 'active') {
            rideData.status = 'finished';
            await store.writeJson(fileKey, rideData);

            // 送迎件数をインクリメント（待機中データ）
            const { incrementRideCount } = require('../../utils/配車/待機列マネージャ');
            await incrementRideCount(guildId, driverId).catch(() => null);

            // 告知メッセージの更新（満員/終了状態へ）
            const channel = await interaction.guild.channels
              .fetch(rideData.channelId)
              .catch(() => null);
            if (channel) {
              const message = await channel.messages.fetch(rideData.messageId).catch(() => null);
              if (message) {
                const { buildCarpoolAnnouncementEmbed } = require('../相乗り/埋め込み作成');
                const embed = buildCarpoolAnnouncementEmbed({
                  ...rideData,
                  botName: interaction.client.user.username,
                  isFull: true,
                });
                embed.setTitle('🏁 送迎終了');
                embed.setColor(0x808080);
                await message.edit({ embeds: [embed], components: [] }).catch(() => null);
              }
            }
          }
        }
      } catch (err) { }

      // 送迎中データ削除
      const activeRideDir = paths.activeDispatchDir(guildId);
      try {
        const activeRideFiles = await store.listKeys(activeRideDir).catch(() => []);
        const jsonFiles = activeRideFiles.filter((f) => f.endsWith('.json'));
        for (const fileKey of jsonFiles) {
          const rideData = await store.readJson(fileKey).catch(() => null);
          if (rideData && rideData.driverId === driverId && rideData.passengerId === targetId) {
            // --- NEW: 送迎中一覧 & 送迎履歴への反映 ---
            try {
              // 1. 送迎中一覧 (Active List) 削除
              const onDutyPath = onDutyDriversJson(guildId);
              const onDutyList = await store.readJson(onDutyPath).catch(() => ({}));
              if (onDutyList && onDutyList[driverId]) {
                delete onDutyList[driverId];
                await store.writeJson(onDutyPath, onDutyList);
              }

              // 2. 送迎履歴 (Global History) 完了化
              const rideDate = new Date(rideData.timestamp); // マッチング時間
              const y = rideDate.getFullYear();
              const m = rideDate.getMonth() + 1;
              const d = rideDate.getDate();
              const historyPath = globalRideHistoryJson(guildId, y, m, d);

              const historyList = await store.readJson(historyPath).catch(() => ({}));
              if (historyList) {
                // driverIdの一致かつ未完了のものを探す
                const entries = Object.values(historyList);
                const targetEntry = entries.find((e) => e.driverId === driverId && !e.endTime);

                if (targetEntry) {
                  targetEntry.endTime = new Date().toISOString();

                  // keyを探して更新
                  const targetKey = Object.keys(historyList).find(
                    (key) => historyList[key] === targetEntry
                  );
                  if (targetKey) {
                    historyList[targetKey] = targetEntry;
                    await store.writeJson(historyPath, historyList);
                  }
                }
              }
            } catch (e) {
              console.error('送迎終了ログ更新エラー', e);
            }
            // ------------------------------------------

            const { updateRideOperatorLog } = require('../../utils/ログ/rideLogManager');
            await updateRideOperatorLog({
              guild: interaction.guild,
              rideId: rideData.rideId || rideData.dispatchId,
              status: 'ENDED',
              data: {
                driverId: driverId,
                userId: targetId,
                area: rideData.route || rideData.direction,
              }
            }).catch(() => null);

            await store.deleteFile(fileKey).catch(() => null);
            break;
          }
        }
      } catch (err) { }

      // --- VC Retention Logic ---
      const vcState = await loadVcState(guildId);

      // Find VC for this pair (Driver & Passenger)
      const vcId = Object.keys(vcState).find((key) => {
        const s = vcState[key];
        return s.driverId === driverId && s.userId === passengerId && !s.endedAt;
      });

      if (vcId) {
        // Mark as ended with Expiration
        const now = new Date();
        const expire = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        await updateVcState(guildId, vcId, {
          endedAt: now.toISOString(),
          expiresAt: expire.toISOString(),
        });

        const vcCh = interaction.guild.channels.cache.get(vcId);
        if (vcCh && vcCh.type === ChannelType.GuildVoice) {
          // Ensure it's a voice channel
          await vcCh
            .send({
              content: '✅ **送迎終了**\nこのチャンネルとチャット履歴は7日後に自動削除されます。',
            })
            .catch(() => { });
        }

        // Memo Channel Notification
        const memoChId = vcState[vcId].memoChannelId;
        if (memoChId) {
          const memoCh = interaction.guild.channels.cache.get(memoChId);
          if (memoCh && memoCh.type === ChannelType.GuildText) {
            // Ensure it's a text channel
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            await memoCh
              .send({
                content:
                  '🧾 **送迎メモチャンネル**\n\nこのチャンネルは送迎終了後 **7日間保存** されます。\n落とし物などで延長が必要な場合は下のボタンを使用してください。',
                components: [
                  new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                      .setCustomId('ride|control|sub=extend')
                      .setLabel('🧳 期間延長（+7日）')
                      .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                      .setCustomId('ride|control|sub=delete')
                      .setLabel('🗑️ 即時削除（管理者）')
                      .setStyle(ButtonStyle.Danger)
                  ),
                ],
              })
              .catch(() => { });
          }
        }
      }
      // --------------------------

      await interaction.followUp({
        content: `送迎を終了しました。\nお疲れさまでした！`,
        flags: 64,
      });

      // パネル更新
      await updateRideListPanel(interaction.guild, interaction.client);
      await updateDriverPanel(interaction.guild, interaction.client);

      // --- 評価システムの統合 ---
      const { sendRatingDM } = require('../配車システム/評価システム');
      // rideData は直前に削除されている場合があるため、必要な情報を保持
      // ここでは interaction から取得できる情報や削除前のデータを元にする
      // 実際には loop 内で各 ride ごとに送る必要があるかもしれないが、
      // 基本的に 1:1 なので、最後に代表して送る（暫定）
      const pseudoDispatchData = {
        dispatchId: `manual_${driverId}_${targetId}_${guildId}`, // 簡易ID
        driverId: driverId,
        passengerId: targetId,
        direction: 'マニュアル送迎', // ルート情報があれば入れたい
        createdAt: new Date().toISOString(),
      };
      await sendRatingDM(interaction.guild, pseudoDispatchData).catch(() => null);
    },
  });
};
