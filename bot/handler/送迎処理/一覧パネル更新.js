// handler/送迎処理/一覧パネル更新.js
const { buildRideListPanelMessage } = require('../送迎パネル/埋め込み作成');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');

async function updateRideListPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.rideList;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildRideListPanelMessage(guild, client),
    suppressFallback: true,
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.rideList.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

module.exports = { updateRideListPanel };
