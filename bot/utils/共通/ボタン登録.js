const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');

module.exports = async function userRegisterButton(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('user:register:modal')
    .setTitle('利用者登録');

  const name = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('店舗名またはニックネーム')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const landmark = new TextInputBuilder()
    .setCustomId('landmark')
    .setLabel('近所の目印')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(name),
    new ActionRowBuilder().addComponents(landmark),
  );

  await interaction.showModal(modal);
};