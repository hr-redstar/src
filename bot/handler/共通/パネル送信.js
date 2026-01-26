// handler/共通/パネル送信.js
const logger = require('../../utils/logger');

/**
 * パネルを送信 or 更新する共通関数
 * @param {Object} options
 * @param {import('discord.js').TextChannel} options.channel
 * @param {string|null} options.messageId 既存パネルID
 * @param {Function} options.buildMessage () => ({ embeds, components })
 * @param {boolean} options.suppressFallback 既存がなければ再送信しない
 * @returns {Promise<string|null>} messageId
 */
async function sendOrUpdatePanel({ channel, messageId, buildMessage, suppressFallback = false }) {
  const payload = await buildMessage();

  // 既存パネルがある場合 → 更新
  if (messageId) {
    // logger.debug(`[パネル送信] 既存メッセージを更新します`, { messageId, channelId: channel.id });
    try {
      const msg = await channel.messages.fetch(messageId);
      await msg.edit(payload);
      // logger.info(`[パネル送信] 既存メッセージを更新しました`, { messageId });
      return msg.id;
    } catch (err) {
      // メッセージが消えているなど
      logger.warn(
        `⚠️ 既存パネル(ID:${messageId})が見つかりません。メッセージが削除された可能性があります。`,
        { error: err.message }
      );

      if (suppressFallback) {
        logger.info('✅ suppressFallback が有効なため、再送信をスキップします。');
        return null;
      }
    }
  } else {
    // logger.debug(`[パネル送信] messageIdがnullのため、新規送信します`, { channelId: channel.id });
  }

  // 新規送信
  try {
    const sent = await channel.send(payload);
    // logger.info(`[パネル送信] 新規メッセージを送信しました`, { messageId: sent.id, channelId: channel.id });
    return sent.id;
  } catch (err) {
    logger.error('❌ パネルの新規送信に失敗しました:', { error: err.message });
    return null;
  }
}

module.exports = {
  sendOrUpdatePanel,
};
