const { EmbedBuilder } = require('discord.js');

/**
 * 共通 Embed テンプレート (v2.0.0 Professional Edition)
 *
 * @param {Object} options
 * @param {string} options.title 機能名（◯◯パネル）
 * @param {string} options.description 機能説明
 * @param {import('discord.js').Client} options.client Discord Client（bot名取得用）
 * @param {Array} options.fields フィールド配列
 * @param {string} options.thumbnail サムネイルURL
 * @param {string} options.type プリセット型 (success|warning|error|info)
 * @param {number} options.color 手動カラー（推奨されません。type を優先）
 */
module.exports = function buildPanelEmbed({ title, description, client, fields, thumbnail, type, color }) {
  const username = client?.user?.username || 'Bot';
  const avatarURL = client?.user?.displayAvatarURL?.() || null;

  // カラーマップ (Flat UI 準拠)
  const colorMap = {
    success: 0x2ecc71, // 緑
    warning: 0xf1c40f, // 黄
    error: 0xe74c3c,   // 赤
    info: 0x3498db,    // 青
  };

  const finalColor = colorMap[type] || color || 0x34495e; // デフォルトはグレー寄り
  const finalTitle = type === 'warning' ? `⚠️ ${title}` : title;

  const embed = new EmbedBuilder()
    .setTitle(finalTitle)
    .setDescription(description || null)
    .setColor(finalColor)
    .setFooter({
      text: `${username}｜${new Date().toLocaleString('ja-JP')}`,
      iconURL: avatarURL,
    })
    .setTimestamp();

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (fields && Array.isArray(fields)) {
    embed.addFields(fields);
  }

  return embed;
};
