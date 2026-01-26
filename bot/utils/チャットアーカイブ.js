const { EmbedBuilder, ThreadAutoArchiveDuration } = require('discord.js');
const { findUserMemoChannel } = require('./findUserMemoChannel');
const { loadConfig } = require('./設定/設定マネージャ');

/**
 * チャンネル内のメッセージを収集し、指定ユーザーのメモチャンネルへスレッド形式で保存する
 */
async function archiveChatToMemo({ guild, channel, userId, dispatchId, title }) {
    const config = await loadConfig(guild.id);
    const memoCategoryId = config.categories?.userMemo;
    if (!memoCategoryId) return;

    // 1. メッセージ収集 (100件まで)
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) return;

    // 時系列順にソート
    const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    // 2. メモチャンネル取得
    const memoChannel = await findUserMemoChannel({
        guild,
        userId,
        categoryId: memoCategoryId,
    });
    if (!memoChannel) return;

    // 3. スレッド作成または取得 (年月スレッド)
    const now = new Date();
    const threadName = `${now.getFullYear()}年${now.getMonth() + 1}月 ログ`;

    let thread = memoChannel.threads.cache.find(t => t.name === threadName);
    if (!thread) {
        thread = await memoChannel.threads.create({
            name: threadName,
            autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            reason: '月別チャットログアーカイブ',
        }).catch(() => null);
    }
    if (!thread) return;

    // 4. まとめて投稿 (Embed)
    const logContent = sorted
        .filter(m => !m.author.bot) // Botメッセージは除外
        .map(m => `**${m.author.username}** (${new Date(m.createdTimestamp).toLocaleTimeString('ja-JP')}): ${m.content}`)
        .join('\n');

    if (!logContent) return;

    const buildPanelEmbed = require('./embed/embedTemplate');
    const embed = buildPanelEmbed({
        title: `📝 チャットログ: ${title || '配車連絡'}`,
        description: logContent.slice(0, 4000) + `\n\n**送迎ID**: \`${dispatchId}\``,
        type: 'info',
        client: guild.client
    });

    await thread.send({ embeds: [embed] }).catch(() => null);
}

module.exports = { archiveChatToMemo };
