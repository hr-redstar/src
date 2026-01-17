const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function buildRatingRankPanelMessage(guild) {
  const embed = new EmbedBuilder()
    .setTitle('🏆 口コミランクパネル')
    .setDescription(
      '送迎者・利用者の口コミ評価を確認し、\nランク階級の登録・設定を行う管理用パネルです。'
    )
    .setColor(0xffd700);

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('adm|rating_check|sub=start')
      .setLabel('📊 口コミ確認')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('adm|history|sub=start')
      .setLabel('📜 履歴表示')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('adm|stats|sub=start')
      .setLabel('📈 統計ダッシュボード')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('adm|rank_tiers|sub=start')
      .setLabel('🏷️ ランク階級設定')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('adm|rank_set|sub=start')
      .setLabel('⚙️ 個別ランク付与')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

module.exports = { buildRatingRankPanelMessage };
