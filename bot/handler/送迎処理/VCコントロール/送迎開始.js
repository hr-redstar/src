const { ActionRowBuilder, ButtonStyle } = require('discord.js');
const { updateDispatchProgress } = require('../../配車システム/dispatchProgressUpdater');

/**
 * 送迎開始ボタンハンドラー (Professional Edition)
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      await interaction.deferUpdate();

      const guild = interaction.guild;
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // データ更新
      const updatedData = await updateDispatchProgress({
        guild,
        rideId,
        status: 'STARTED',
        updates: {
          startTime: timeStr,
          rideStartedAt: now.toISOString()
        }
      });

      if (!updatedData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      const isDriver = interaction.user.id === updatedData.driverId;
      const isUser = interaction.user.id === updatedData.userId;
      const carpoolIndex = (updatedData.carpoolUsers || []).findIndex(u => u.userId === interaction.user.id);

      await interaction.channel.send(`※送迎開始通知：<@${interaction.user.id}> (${timeStr})`);

      // ボタン表示の更新
      const newComponents = interaction.message.components.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach((component) => {
          if (component.customId === interaction.customId) {
            let label = component.label;
            if (isDriver && !label.includes('済')) label += '(送迎者済)';
            else if (isUser && !label.includes('済')) label += '(利用者済)';
            else if (carpoolIndex >= 0 && !label.includes('済')) label += `(計${carpoolIndex + 1}済)`;

            component.setLabel(label);
          }
        });
        return newRow;
      });

      await interaction.editReply({ components: newComponents });

    } catch (error) {
      console.error('送迎開始エラー:', error);
      await interaction.followUp({ content: '⚠️ エラーが発生しました。', flags: 64 }).catch(() => null);
    }
  }
};
