const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * グローバルログを送信
 */
async function postGlobalLog({ guild, embeds, content }) {
    const config = await loadConfig(guild.id);
    const channelId = config.logs.globalChannel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ content, embeds }).catch(() => null);
}

module.exports = { postGlobalLog };
