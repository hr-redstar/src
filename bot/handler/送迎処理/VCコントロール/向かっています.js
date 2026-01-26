const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');
const { ActionRowBuilder } = require('discord.js');
const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');

/**
 * 向かっています 通知処理 (High-Performance Edition)
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      const guildId = interaction.guildId;
      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.reply({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      // 1. 権限ガード (送迎者のみ)
      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.reply({
          content: '❌ この操作は送迎担当者のみ実行できます。',
          flags: 64
        });
      }

      // 2. ステータスガード (二重送信防止)
      const { RideStatus } = require('../../../utils/constants');
      if (dispatchData.status !== RideStatus.MATCHED && dispatchData.status !== 'dispatching') {
        const statusLabel = {
          HEADING: '既に向かっています',
          STARTED: '既に送迎を開始しています',
          COMPLETED: '既に送迎を終了しています'
        }[dispatchData.status] || '既に処理済み';

        return interaction.reply({
          content: `⚠️ 操作をスキップしました：${statusLabel}。`,
          flags: 64
        });
      }

      await interaction.deferUpdate();

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // データ更新
      const updatedData = await updateDispatchProgress({
        guild: interaction.guild,
        rideId,
        status: 'HEADING',
        updates: {
          headingTime: timeStr,
          departedAt: now.toISOString()
        }
      });

      if (!updatedData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      await interaction.followUp({
        content: `※向かっています：<@${interaction.user.id}> (${timeStr})`,
        flags: 64
      });

      // ボタン無効化
      const newComponents = interaction.message.components.map(row => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach(c => {
          if (c.customId === interaction.customId) c.setDisabled(true);
        });
        return newRow;
      });

      await interaction.editReply({ components: newComponents });

    } catch (error) {
      console.error('向かっていますエラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
