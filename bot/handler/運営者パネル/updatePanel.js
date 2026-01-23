const { loadConfig } = require('../../utils/設定/設定マネージャ');
const mainModule = require('./メイン');

/**
 * 運営者パネルを更新
 */
async function updateOperatorPanel(guild, client) {
  try {
    const config = await loadConfig(guild.id);
    const panel = config.panels?.operatorPanel;

    if (!panel || !panel.messageId || !panel.channelId) {
      console.warn('[パネル更新] operatorPanel の設定が見つかりません');
      return false;
    }

    const channel = guild.channels.cache.get(panel.channelId);
    if (!channel) {
      console.warn('[パネル更新] チャンネルが見つかりません:', panel.channelId);
      return false;
    }

    const message = await channel.messages.fetch(panel.messageId).catch(() => null);
    if (!message) {
      console.warn('[パネル更新] メッセージが見つかりません:', panel.messageId);
      return false;
    }

    // 埋め込みとコンポーネントを再構築
    const embed = await mainModule.buildOperatorPanelMessage(guild, config, client);
    
    // buildOperatorPanelMessage の戻り値は { embeds, components } のオブジェクト
    await message.edit(embed);
    
    console.log('[パネル更新] 運営者パネルを更新しました');
    return true;
  } catch (error) {
    console.error('[パネル更新] エラー:', error);
    return false;
  }
}

module.exports = updateOperatorPanel;
