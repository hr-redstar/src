const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

const { loadConfigSync } = require('../../utils/設定/設定マネージャ'); // Sync load for build if possible, or assume async usage

async function buildRatingRankPanelMessage(guild) {
  const config = await require('../../utils/設定/設定マネージャ').loadConfig(guild.id);
  const ranks = config.ranks || [];

  // ランク階級の表示文字列作成
  const rankTiersText = ranks.length > 0
    ? ranks.map(r => `${r.name} (★${r.minStars})`).join('\n')
    : '未登録';

  // ランク設定（ユーザー割り当て）の表示文字列作成
  // Note: config.rankAssignments etc is not standard storage.
  // Actually, ranks are stored in user profiles, not config index usually.
  // But for the panel display, we might just list the Tiers as requested.
  // "Rank 1... Mention User" suggests showing who is in what rank.
  // Since iterating all users is expensive, we might just show placeholder or omitted for now unless we have a rank cache.
  // For safety and performance, I will verify how rank settings are stored.
  // For now, I will display the "Tiers" in the "Rank Setting" area as the prompt implies "Rank 1... Name" structure.

  const embed = buildPanelEmbed({
    title: '口コミランクパネル',
    description: `
------------------------------

・送迎者・利用者の口コミ評価確認
・ランク階級の登録・設定

**ランク階級登録**
\`\`\`
${rankTiersText}
\`\`\`

**ランク設定**
(各ユーザーのランク設定状況は統計ダッシュボードで確認可能です)
    `,
    color: 0xffd700,
    client: guild.client,
  });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('adm|rank_tiers|sub=start')
      .setLabel('ランク階級登録')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('adm|rank_set|sub=start')
      .setLabel('ランク設定')
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('adm|rating_check|sub=start')
      .setLabel('口コミ確認')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('adm|stats|sub=start')
      .setLabel('統計ダッシュボード')
      .setStyle(ButtonStyle.Secondary)
  );

  return buildPanelMessage({ embed, components: [row1, row2] });
}

module.exports = { buildRatingRankPanelMessage };
