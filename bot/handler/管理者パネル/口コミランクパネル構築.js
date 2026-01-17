const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildRatingRankPanelMessage(guild) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 口コミランクパネル')
    .setDescription(
      '送迎者・利用者の口コミ評価を確認し、\nランク階級の登録・設定を行う管理用パネルです。'
    )
    .setColor(0xffd700);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('adm|rating_check|sub=start')
      .setLabel('📊 口コミ確認')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('adm|rank_tiers|sub=start')
      .setLabel('🏷️ ランク階級登録')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('adm|rank_set|sub=start')
      .setLabel('⚙️ ランク設定')
      .setStyle(ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = { buildRatingRankPanelMessage };
