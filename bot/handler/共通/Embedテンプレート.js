// handler/共通/Embedテンプレート.js

const { EmbedBuilder } = require('discord.js');

/**
 * ベースとなるパネル Embed を生成する
 */
function buildBasePanelEmbed({ title, description, botName }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: botName,
    })
    .setTimestamp();
}

module.exports = {
  buildBasePanelEmbed,
};
