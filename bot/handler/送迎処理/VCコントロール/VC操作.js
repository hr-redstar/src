const handleApproach = require('./向かっています');
const handleStart = require('./送迎開始');
const handleEnd = require('./送迎終了');
const { updateVcState } = require('../../utils/vcStateStore');
const { EmbedBuilder } = require('discord.js');
const paths = require('../../utils/ストレージ/ストレージパス');

/**
 * VC操作ルーター
 * カスタムID形式: ride|action|rid=rideId
 */
module.exports = async function (interaction, parsed) {
  const action = parsed?.action;
  const sub = parsed?.params?.sub;
  const rid = parsed?.params?.rid;

  if (action === 'approach') {
    return handleApproach(interaction, rid);
  }
  if (action === 'start') {
    return handleStart(interaction, rid);
  }
  if (action === 'end') {
    return handleEnd(interaction, rid);
  }

  // ride|control|sub=extend
  if (action === 'control') {
    if (sub === 'extend') {
      // 削除延長
      const channelId = interaction.channelId;
      const guildId = interaction.guildId;

      try {
        await interaction.deferUpdate();

        const state = await require('../../utils/vcStateStore').loadVcState(guildId);
        const vcData = state[channelId];

        if (!vcData) {
          return interaction.followUp({
            content: '⚠️ このチャンネルのデータが見つかりません。',
            flags: 64,
          });
        }

        // 更新: expiresAt を null (無期限) に
        await updateVcState(guildId, channelId, { expiresAt: null });

        // メッセージ更新 (ボタン無効化など)
        const currentEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(currentEmbed)
          .setDescription(
            currentEmbed.description + '\n\n✅ **保存期間を延長しました（無期限保存）**'
          )
          .setColor(0x2ecc71); // Green

        await interaction.editReply({ embeds: [newEmbed], components: [] });

        // 管理者ログ送信
        const { loadConfig } = require('../../utils/設定/設定マネージャ');
        const config = await loadConfig(guildId);
        const logThreadId = config.channels?.adminLogThread;
        if (logThreadId) {
          const thread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
          if (thread) {
            await thread.send({
              content: `⏳ **保存期間延長**\n実行者: <@${interaction.user.id}>\nチャンネル: <#${channelId}>`,
            });
          }
        }

        // 運営者ログ同期 (赤)
        // rid があれば dispatchData を更新して同期
        if (rid) {
          const store = require('../../utils/ストレージ/ストア共通');
          const activePath = `${paths.activeDispatchDir(guildId)}/${rid}.json`;
          const dispatchData = await store.readJson(activePath).catch(() => null);
          if (dispatchData) {
            dispatchData.isExtended = true;
            await store.writeJson(activePath, dispatchData);

            const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
            await updateRideOperatorLog({
              guild: interaction.guild,
              rideId: rid,
              status: 'ENDED',
              data: {
                isExtended: true,
              },
            }).catch(() => null);
          }
        }
      } catch (error) {
        console.error('削除延長エラー:', error);
        await interaction
          .followUp({ content: '⚠️ エラーが発生しました。', flags: 64 })
          .catch(() => null);
      }
      return;
    }

    if (sub === 'delete') {
      // 管理者による即時削除（必要なら実装）
      // ...
    }
  }
};
