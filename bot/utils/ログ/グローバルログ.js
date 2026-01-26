const { EmbedBuilder } = require('discord.js');
// utils/ログ/グローバルログ.js
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * グローバルログを送信 (v2.8.5)
 */
async function postGlobalLog({ guild, embeds }) {
    const config = await loadConfig(guild.id);
    const targetChannelId = config.logs?.globalChannel;
    if (!targetChannelId) return;

    const channel =
        guild.channels.cache.get(targetChannelId) ||
        (await guild.channels.fetch(targetChannelId).catch(() => null));
    if (!channel || !channel.isTextBased()) return;

    await channel.send({ embeds }).catch(() => null);
}

module.exports = { postGlobalLog };
