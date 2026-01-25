const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');
const { ActionRowBuilder } = require('discord.js');

/**
 * 向かっています 通知処理 (High-Performance Edition)
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
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
