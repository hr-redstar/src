const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { sendOrUpdatePanel } = require('../共通/パネル送信');

async function buildRatingRankPanelMessage(guild, config = null) {
  if (!config) config = await loadConfig(guild.id);
  const tiers = config.ranks?.tiers || [];

  // ランク階級の表示文字列作成
  const rankTiers = Array.isArray(config.ranks?.tiers) ? config.ranks.tiers : [];
  const rankTiersText = rankTiers.length > 0
    ? rankTiers.join(' > ')
    : '未登録';

  // ランク設定状況の表示
  let rankSettingsText = '';
  if (tiers.length > 0) {
    const userRanks = config.ranks?.userRanks || {};
    // 逆引き作成: { 'ゴールド': ['id1', 'id2'], ... }
    const tierMembers = {};
    tiers.forEach(t => tierMembers[t] = []);
    Object.entries(userRanks).forEach(([uid, rank]) => {
      if (tierMembers[rank]) tierMembers[rank].push(uid);
    });

    rankSettingsText = tiers.map(t => {
      const members = tierMembers[t];
      const memberList = members.length > 0 ? members.map(uid => `<@${uid}>`).join(' ') : '（なし）';
      return `**${t}**\n${memberList}`;
    }).join('\n\n');
  } else {
    rankSettingsText = '(ランク階級が登録されていません)';
  }

  const embed = buildPanelEmbed({
    title: '⭐ 口コミ・ランク管理システム',
    description: '送迎者および利用者の評価管理、および独自のランク階級を構築・運用します。',
    fields: [
      { name: '📊 システム構成', value: `**登録ランク階級**: \n\`\`\`\n${rankTiersText}\n\`\`\``, inline: false },
      { name: '👤 ランク設定状況', value: rankSettingsText, inline: false },
      { name: '📝 評価管理項目', value: '• 送迎者・利用者の口コミ評価のリアルタイム確認\n• 個別および一括のランク付与・変更', inline: false },
    ],
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
