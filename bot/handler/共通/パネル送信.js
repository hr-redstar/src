/**
 * パネルを送信 or 更新する共通関数
 * @param {Object} options
 * @param {import('discord.js').TextChannel} options.channel
 * @param {string|null} options.messageId 既存パネルID
 * @param {Function} options.buildMessage () => ({ embeds, components })
 * @param {boolean} options.suppressFallback 既存がなければ再送信しない
 * @returns {Promise<string|null>} messageId
 */
async function sendOrUpdatePanel({
    channel,
    messageId,
    buildMessage,
    suppressFallback = false,
}) {
    const payload = await buildMessage();

    // 既存パネルがある場合 → 更新
    if (messageId) {
        try {
            const msg = await channel.messages.fetch(messageId);
            await msg.edit(payload);
            return msg.id;
        } catch (err) {
            // メッセージが消えているなど
            console.warn(
                `⚠️ 既存パネル(ID:${messageId})が見つかりません。メッセージが削除された可能性があります。`
            );

            if (suppressFallback) {
                console.info('✅ suppressFallback が有効なため、再送信をスキップします。');
                return null;
            }
        }
    }

    // 新規送信
    try {
        const sent = await channel.send(payload);
        return sent.id;
    } catch (err) {
        console.error('❌ パネルの新規送信に失敗しました:', err.message);
        return null;
    }
}

module.exports = {
    sendOrUpdatePanel,
};
