const { EmbedBuilder } = require('discord.js');

/**
 * 共通 Embed テンプレート
 *
 * @param {Object} options
 * @param {string} options.title 機能名（◯◯パネル）
 * @param {string} options.description 機能説明
 * @param {import('discord.js').Client} options.client Discord Client（bot名取得用）
 * @param {Array} options.fields フィールド配列
 * @param {string} options.thumbnail サムネイルURL
 * @param {number} options.color カラーコード
 */
module.exports = function buildPanelEmbed({ title, description, client, fields, thumbnail, color }) {
  const username = client?.user?.username || 'Bot';
  const avatarURL = client?.user?.displayAvatarURL?.() || null;

  const embed = new EmbedBuilder()
    .setTitle(title) // 呼び出し側でアイコンを含めるため、ここでは自動付与しない
    .setDescription(description || null)
    .setFooter({
      text: `${username}｜${new Date().toLocaleString('ja-JP')}`,
      iconURL: avatarURL,
    })
    .setTimestamp();

  if (color) {
    embed.setColor(color);
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (fields && Array.isArray(fields)) {
    embed.addFields(fields);
  }

  return embed;
};
