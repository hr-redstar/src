// src/bot/handler/パネル設置/アクション/パネル移動.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CUSTOM_ID } = require('../共通/_panelSetupCommon');
const autoInteractionTemplate = require('../../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  customId: CUSTOM_ID.PANEL_MOVE,
  type: 'button',
  async execute(interaction) {
    return autoInteractionTemplate(interaction, {
      ack: ACK.UPDATE,
      adminOnly: true,
      async run(interaction) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(CUSTOM_ID.SEND_ADMIN_PANEL)
            .setLabel('管理者パネル')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(CUSTOM_ID.SEND_DRIVER_PANEL)
            .setLabel('送迎者パネル')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(CUSTOM_ID.SEND_USER_PANEL)
            .setLabel('利用者パネル')
            .setStyle(ButtonStyle.Primary)
        );

        await interaction.editReply({
          content: '移動先のパネル選択に戻ります。',
          components: [row],
        });
      },
    });
  },
};
