const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { loadDriver } = require('../../utils/driversStore');

module.exports = async (interaction) => {
  // 既存データの読み込み
  const existingData = await loadDriver(interaction.guild.id, interaction.user.id);

  const modal = new ModalBuilder().setCustomId('reg|driver|sub=modal').setTitle('送迎者登録');

  const area = new TextInputBuilder()
    .setCustomId('input|driver|area')
    .setLabel('活動拠点 / 活動区域')
    .setPlaceholder('例：駅前、北千住周辺 など')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);
  if (existingData?.area) area.setValue(existingData.area);

  modal.addComponents(
    new ActionRowBuilder().addComponents(area),
    new ActionRowBuilder().addComponents(nickname),
    new ActionRowBuilder().addComponents(car),
    new ActionRowBuilder().addComponents(capacity)
  );

  await interaction.showModal(modal);
};
