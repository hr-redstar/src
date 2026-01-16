const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');

/**
 * 運営者ログを送信
 * 管理者ログとは異なり、スレッド管理は行わず、指定されたチャンネルに直接送信する
 */
async function postOperatorLog({ guild, embeds }) {
    const config = await loadConfig(guild.id);
    const targetChannelId = config.logs.operatorChannel;
    if (!targetChannelId) return;

    const channel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    // チャンネルに直接送信（スレッド管理なし）
    await channel.send({ embeds }).catch(() => null);
}

module.exports = { postOperatorLog };
