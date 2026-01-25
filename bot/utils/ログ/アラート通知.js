const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');
const { postOperatorLog } = require('./運営者ログ');

/**
 * 重大なシステムエラーや異常を管理・運用者に通知する
 * @param {Object} params
 * @param {Guild} params.guild
 * @param {string} params.title タイトル
 * @param {string} params.message メッセージ内容
 * @param {Error} [params.error] エラーオブジェクト
 * @param {Object} [params.meta] 付随情報
 * @param {boolean} [params.mentionEveryone=false] @everyone を付けるか
 */
async function sendCriticalAlert({
    guild,
    title,
    message,
    error,
    meta = {},
    mentionEveryone = false,
}) {
    const config = await loadConfig(guild.id);
    const color = 0xff0000; // Red for critical

    const buildPanelEmbed = require('../embed/embedTemplate');
    const embed = buildPanelEmbed({
        title: `🚨 【要確認】${title}`,
        description: message,
        color: color,
        client: guild.client,
    });

    if (error) {
        const errorDetail = error.stack
            ? `\`\`\`js\n${error.stack.slice(0, 1000)}\n\`\`\``
            : `\`${error.message || error}\``;
        embed.addFields({ name: 'エラー詳細', value: errorDetail });
    }

    if (Object.keys(meta).length > 0) {
        const metaStr = Object.entries(meta)
            .map(([k, v]) => `**${k}**: ${v}`)
            .join('\n');
        embed.addFields({ name: '付随情報', value: metaStr.slice(0, 1024) });
    }

    // 1. 運営者ログ (Discordチャンネル)
    const content = mentionEveryone ? '@everyone' : null;
    await postOperatorLog({ guild, content, embeds: [embed] }).catch(() => null);

    // 2. 管理者ログスレッド
    const threadId = config.logs?.adminLogThread;
    if (threadId) {
        const thread = await guild.channels.fetch(threadId).catch(() => null);
        if (thread && thread.isThread()) {
            await thread.send({ content: `🚨 **CRITICAL ALERT**`, embeds: [embed] }).catch(() => null);
        }
    }
}

module.exports = { sendCriticalAlert };
