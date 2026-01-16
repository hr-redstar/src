const { EmbedBuilder } = require('discord.js');

/**
 * 共通 Embed テンプレート
 *
 * @param {Object} options
 * @param {string} options.title 機能名（◯◯パネル）
 * @param {string} options.description 機能説明
 * @param {import('discord.js').Client} options.client Discord Client（bot名取得用）
 */
module.exports = function buildPanelEmbed({
    title,
    description,
    client,
    color,
}) {
    const embed = new EmbedBuilder()
        .setTitle(`📋 ${title}`)
        .setDescription(description)
        .setFooter({
            text: `${client.user.username}｜${new Date().toLocaleString('ja-JP')}`,
            iconURL: client.user.displayAvatarURL(),
        });

    if (color) {
        embed.setColor(color);
    }

    return embed;
};
