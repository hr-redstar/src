const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports.sendDriverRegisterPanel = async (channel) => {
  const embed = new EmbedBuilder()
    .setTitle('🚗 送迎者登録パネル')
    .setDescription(
      ['送迎登録', '', '区域：', '停留場所：', 'ニックネーム：', '車種：', '乗車人数：'].join('\n')
    )
    .setColor(0x2ecc71);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('driver:btn:register')
      .setLabel('送迎者登録')
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    embeds: [embed],
    components: [row],
  });
};
