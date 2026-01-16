// handler/送迎パネル/アクション/現在地更新.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const autoInteractionTemplate = require("../../共通/autoInteractionTemplate");
const { ACK } = autoInteractionTemplate;

module.exports = async function (interaction) {
  return autoInteractionTemplate(interaction, {
    ack: ACK.NONE,
    async run(interaction) {
      const modal = new ModalBuilder()
        .setCustomId('driver:location:modal')
        .setTitle('現在地の更新');

      const locInput = new TextInputBuilder()
        .setCustomId('input:driver:location')
        .setLabel('現在の場所')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(
        new ActionRowBuilder().addComponents(locInput)
      );

      await interaction.showModal(modal);
    }
  });
};
