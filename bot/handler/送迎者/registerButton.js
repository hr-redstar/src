const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadDriver } = require('../../utils/driversStore');

module.exports = async (interaction) => {
  // 既存データの読み込み
  const existingData = await loadDriver(interaction.guild.id, interaction.user.id);

  const modal = new ModalBuilder().setCustomId('driver:modal:register').setTitle('送迎者登録');

  const area = new TextInputBuilder()
    .setCustomId('driver:input:area')
    .setLabel('区域')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  if (existingData?.area) area.setValue(existingData.area);

  const stop = new TextInputBuilder()
    .setCustomId('driver:input:stop')
    .setLabel('停留場所')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  if (existingData?.stop) stop.setValue(existingData.stop);

  const nickname = new TextInputBuilder()
    .setCustomId('driver:input:nickname')
    .setLabel('ニックネーム')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  if (existingData?.nickname) nickname.setValue(existingData.nickname);

  const car = new TextInputBuilder()
    .setCustomId('driver:input:car')
    .setLabel('車種')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);
  if (existingData?.car) car.setValue(existingData.car);

  const capacity = new TextInputBuilder()
    .setCustomId('driver:input:capacity')
    .setLabel('乗車人数')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  if (existingData?.capacity) capacity.setValue(String(existingData.capacity));

  modal.addComponents(
    new ActionRowBuilder().addComponents(area),
    new ActionRowBuilder().addComponents(stop),
    new ActionRowBuilder().addComponents(nickname),
    new ActionRowBuilder().addComponents(car),
    new ActionRowBuilder().addComponents(capacity)
  );

  await interaction.showModal(modal);
};
