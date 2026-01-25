const handleApproach = require('./向かっています');
const handleStart = require('./送迎開始');
const handleEnd = require('./送迎終了');
const handleCancel = require('./送迎キャンセル');
const { updateVcState } = require('../../../utils/vcStateStore');
const { EmbedBuilder } = require('discord.js');
const paths = require('../../../utils/ストレージ/ストレージパス');

/**
 * VC操作ルーター
 * カスタムID形式: ride|action|rid=rideId
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const action = parsed?.action;
    const sub = parsed?.params?.sub;
    const rid = parsed?.params?.rid;

    if (action === 'approach') {
      return handleApproach.execute(interaction, client, parsed);
    }
    if (action === 'start') {
      return handleStart.execute(interaction, client, parsed);
    }
    if (action === 'end') {
      // 送迎終了ボタン -> 目的地入力モーダルを表示
      if (!sub) return handleEnd.execute(interaction, client, parsed);
      // モーダル送信時
      if (sub === 'submit') return handleEnd.execute(interaction, client, parsed);
    }
    if (action === 'cancel') {
      return handleCancel.execute(interaction, client, parsed);
    }

    // 相乗り操作系 (v2.9.2 Select Menus)
    if (action.startsWith('carpool_')) {
      const carpoolMenu = require('./相乗り操作メニュー');
      if (action === 'carpool_select') {
        return carpoolMenu.handleCarpoolAction(interaction, client, parsed);
      }
      return carpoolMenu.showCarpoolSelectMenu(interaction, action, rid);
    }

    // ride|control|sub=extend
    if (action === 'control') {
      if (sub === 'extend') {
        const channelId = interaction.channelId;
        const guildId = interaction.guildId;

        try {
          await interaction.deferUpdate();

          const state = await require('../../../utils/vcStateStore').loadVcState(guildId);
          const vcData = state[channelId];

          if (!vcData) {
            return interaction.followUp({
              content: '⚠️ このチャンネルのデータが見つかりません。',
              flags: 64,
            });
          }

          await updateVcState(guildId, channelId, { expiresAt: null });

          const currentEmbed = interaction.message.embeds[0];
          const newEmbed = EmbedBuilder.from(currentEmbed)
            .setDescription(
              (currentEmbed.description || '') + '\n\n✅ **保存期間を延長しました（無期限保存）**'
            )
            .setColor(0x2ecc71);

          await interaction.editReply({ embeds: [newEmbed], components: [] });

          const { loadConfig } = require('../../../utils/設定/設定マネージャ');
          const config = await loadConfig(guildId);
          const logThreadId = config.logs?.adminLogThread || config.channels?.adminLogThread;
          if (logThreadId) {
            const thread = await interaction.guild.channels.fetch(logThreadId).catch(() => null);
            if (thread) {
              const buildPanelEmbed = require('../../../utils/embed/embedTemplate');
              const logEmbed = buildPanelEmbed({
                title: '⏳ 保存期間延長',
                description: `送迎チャンネルの保存期間が無期限に延長されました。\n\n**実行者:** <@${interaction.user.id}>\n**チャンネル:** <#${channelId}>`,
                color: 0x3498db,
                client: client,
              });
              await thread.send({ embeds: [logEmbed] });
            }
          }

          if (rid) {
            const store = require('../../../utils/ストレージ/ストア共通');
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
    }
  }
};
