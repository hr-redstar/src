const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { sendOrUpdatePanel } = require('../共通/パネル送信');

async function buildRatingRankPanelMessage(guild, config = null) {
  if (!config) config = await loadConfig(guild.id);
  const tiers = config.ranks?.tiers || [];

  // ランク階級の表示文字列作成
  const rankTiersText = tiers.length > 0
    ? tiers.join(' > ')
    : '未登録';

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

/**
 * 口コミランクパネルを更新
 */
async function updateRatingRankPanelMessage(guild, cfg, client) {
  const panel = cfg.panels?.ratingRank;
  if (!panel || !panel.channelId) return false;

  const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!ch) return false;

  const newMessageId = await sendOrUpdatePanel({
    channel: ch,
    messageId: panel.messageId,
    buildMessage: async () => buildRatingRankPanelMessage(guild, cfg),
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    if (!cfg.panels) cfg.panels = {};
    if (!cfg.panels.ratingRank) cfg.panels.ratingRank = {};
    cfg.panels.ratingRank.messageId = newMessageId;
    // saveConfig は呼び出し元で行う、または自動復旧時に行われる
  }
  return true;
}

module.exports = {
  buildRatingRankPanelMessage,
  updateRatingRankPanelMessage
};
