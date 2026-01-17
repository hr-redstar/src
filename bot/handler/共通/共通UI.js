// src/bot/handler/共通/共通UI.js
const { EmbedBuilder } = require('discord.js');

/**
 * 統一された形式の Embed を生成する
 * @param {object} options
 * @param {string} options.title パネルの名前（例: "送迎者"）
 * @param {string} options.description 説明文
 * @param {number} [options.color] 色（デフォルト: 0x3498db）
 * @param {Client} client クライアントオブジェクト（フッターにbot名を表示するため）
 * @returns {EmbedBuilder}
 */
function buildCommonEmbed({ title, description, color = 0x3498db }, client) {
  const embed = new EmbedBuilder()
    .setTitle(`${title}パネル`)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (client?.user?.username) {
    embed.setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL() });
  }

  return embed;
}

module.exports = {
  buildCommonEmbed,
};
