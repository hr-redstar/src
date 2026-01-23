const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadDriver } = require('../../utils/driversStore');

module.exports = async (interaction) => {
  // 既存データの読み込み
  const existingData = await loadDriver(interaction.guild.id, interaction.user.id);

  const modal = new ModalBuilder().setCustomId('reg|driver|sub=modal').setTitle('送迎者登録');

  const nickname = new TextInputBuilder()
    .setCustomId('input|driver|nickname')
    .setLabel('ニックネーム')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  if (existingData?.nickname) nickname.setValue(existingData.nickname);

  const car = new TextInputBuilder()
    .setCustomId('input|driver|car')
    .setLabel('車種/カラー/ナンバー')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  if (existingData?.car) car.setValue(existingData.car);

  const capacity = new TextInputBuilder()
    .setCustomId('input|driver|capacity')
    .setLabel('乗車人数')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  if (existingData?.capacity) capacity.setValue(String(existingData.capacity));

  modal.addComponents(
    new ActionRowBuilder().addComponents(nickname),
    new ActionRowBuilder().addComponents(car),
    new ActionRowBuilder().addComponents(capacity)
  );

  await interaction.showModal(modal);
};
