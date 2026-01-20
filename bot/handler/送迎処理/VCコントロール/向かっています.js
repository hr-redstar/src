const store = require('../../../utils/ストレージ/ストア共通');
const paths = require('../../../utils/ストレージ/ストレージパス');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * 「向かっています」ボタンハンドラー
 */
module.exports = {
  async execute(interaction, client, parsed) {
    const rideId = parsed?.params?.rid;
    if (!rideId) return;

    try {
      await interaction.deferUpdate();

      const guild = interaction.guild;
      const guildId = guild.id;

      const activePath = `${paths.activeDispatchDir(guildId)}/${rideId}.json`;
      const dispatchData = await store.readJson(activePath).catch(() => null);

      if (!dispatchData) {
        return interaction.followUp({ content: '⚠️ 送迎データが見つかりません。', flags: 64 });
      }

      if (interaction.user.id !== dispatchData.driverId) {
        return interaction.followUp({ content: '⚠️ 送迎者のみが実行できます。', flags: 64 });
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (dispatchData.approachTime)
        return interaction.followUp({ content: '⚠️ 既に通知済みです。', flags: 64 });

      dispatchData.approachTime = timeStr;

      const { updateRideOperatorLog } = require('../../../utils/ログ/rideLogManager');
      await updateRideOperatorLog({
        guild,
        rideId: rideId,
        status: 'DEPARTED',
        data: {
          departedAt: now.toISOString(),
        },
      }).catch(() => null);

      await store.writeJson(activePath, dispatchData);

      await interaction.channel.send({
        content: `※向かっています：<@${interaction.user.id}> (${timeStr})`,
      });

      const { buildVcControlEmbed } = require('../../../utils/配車/vcControlEmbedBuilder');
      const newEmbed = buildVcControlEmbed(dispatchData);

      const currentComponents = interaction.message.components;
      const newComponents = currentComponents.map((row) => {
        const newRow = ActionRowBuilder.from(row);
        newRow.components.forEach((component) => {
          if (component.customId === interaction.customId) {
            component.setDisabled(true);
          }
        });
        return newRow;
      });

      await interaction.editReply({ embeds: [newEmbed], components: newComponents });
    } catch (error) {
      console.error('向かっていますエラー:', error);
      await interaction
        .followUp({ content: '⚠️ エラーが発生しました。', flags: 64 })
        .catch(() => null);
    }
  }
};
