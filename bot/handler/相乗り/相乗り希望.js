// handler/相乗り/相乗り希望.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

module.exports = {
  execute: async function (interaction, parsed) {
    // carpool|join|rid={rideId}
    const rideId = parsed?.params?.rid;

    return autoInteractionTemplate(interaction, {
      ack: ACK.NONE,
      async run(interaction) {
        const modal = new ModalBuilder()
          .setCustomId(`carpool|join|sub=modal&rid=${rideId}`)
          .setTitle('相乗り希望');

        const locationInp = new TextInputBuilder()
          .setCustomId('input:carpool:location')
          .setLabel('現在地または乗車場所')
          .setPlaceholder('例: 駅前ロータリー、店舗前など')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100);

        // 人数入力（仕様により追加）
        const countInp = new TextInputBuilder()
          .setCustomId('input:carpool:count')
          .setLabel('乗車人数')
          .setPlaceholder('例: 1')
          .setStyle(TextInputStyle.Short)
          .setValue('1')
          .setRequired(true)
          .setMaxLength(2);

        modal.addComponents(
          new ActionRowBuilder().addComponents(locationInp),
          new ActionRowBuilder().addComponents(countInp)
        );

        await interaction.showModal(modal);
      },
    });
  },
};
