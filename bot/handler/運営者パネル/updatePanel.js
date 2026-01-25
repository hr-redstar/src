const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const mainModule = require('./メイン');
const { sendOrUpdatePanel } = require('../共通/パネル送信');

/**
 * 運営者パネルを更新
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @param {Object} options
 * @param {boolean} options.forceResend 既存メッセージを削除して再送信するか
 */
async function updateOperatorPanel(guild, client, { forceResend = false } = {}) {
  try {
    const config = await loadConfig(guild.id);
    const panelCfg = config.panels?.operatorPanel;

    if (!panelCfg || !panelCfg.channelId) {
      console.warn('[パネル更新] operatorPanel のチャネル設定が見つかりません');
      return false;
    }

    const channel = guild.channels.cache.get(panelCfg.channelId) ||
      await guild.channels.fetch(panelCfg.channelId).catch(() => null);
    if (!channel) {
      console.warn('[パネル更新] 運営者パネルのチャンネルが見つかりません:', panelCfg.channelId);
      return false;
    }

    let currentMessageId = panelCfg.messageId;

    // 強制再送信の場合は既存を削除
    if (forceResend && currentMessageId) {
      const oldMsg = await channel.messages.fetch(currentMessageId).catch(() => null);
      if (oldMsg) {
        await oldMsg.delete().catch(() => null);
      }
      currentMessageId = null; // messageIdをクリアして新規送信を促す
    }

    // パネル送信/更新
    const newMessageId = await sendOrUpdatePanel({
      channel,
      messageId: currentMessageId,
      buildMessage: () => mainModule.buildOperatorPanelMessage(guild, config, client),
    });

    if (newMessageId && newMessageId !== panelCfg.messageId) {
      config.panels.operatorPanel.messageId = newMessageId;
      await saveConfig(guild.id, config);
      console.log('[パネル更新] 運営者パネルのメッセージIDを更新しました:', newMessageId);
    }

    console.log(`[パネル更新] 運営者パネルを${forceResend ? '再送信' : '更新'}しました`);
    return true;
  } catch (error) {
    console.error('[パネル更新] エラー:', error);
    return false;
  }
}

module.exports = updateOperatorPanel;
