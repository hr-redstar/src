/**
 * パネルメッセージ基盤テンプレート
 * 
 * @param {Object} options
 * @param {import('discord.js').EmbedBuilder} options.embed
 * @param {import('discord.js').ActionRowBuilder[]} options.components
 */
module.exports = function buildPanelMessage({ embed, components = [] }) {
    return {
        embeds: [embed],
        components,
    };
};
