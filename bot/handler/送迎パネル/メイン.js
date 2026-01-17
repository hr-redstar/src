// handler/送迎パネル/メイン.js
const logger = require("../../utils/logger");
const store = require("../../utils/ストレージ/ストア共通");
const paths = require("../../utils/ストレージ/ストレージパス");
const { sendOrUpdatePanel } = require("../共通/パネル送信");
const { loadConfig, saveConfig } = require("../../utils/設定/設定マネージャ");
const { buildDriverPanelMessage } = require("./埋め込み作成");

async function updateDriverPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.driverPanel;

  if (!panel || !panel.channelId) return;

  const channel = guild.channels.cache.get(panel.channelId) || await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!channel) return;

  // 待機中の送迎者数をカウント
  const { getQueue } = require('../../utils/配車/待機列マネージャ');
  const queue = await getQueue(guild.id);
  const activeCount = queue.length;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildDriverPanelMessage(guild, activeCount, client),
    suppressFallback: true, // 自動更新時は勝手に再送しない
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.driverPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

// ===== Handler =====
async function execute(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  try {
    if (action === 'on') return require('./アクション/出勤')(interaction);
    if (action === 'off') return require('./アクション/退勤')(interaction);
    if (action === 'location') return require('./アクション/現在地更新')(interaction);
  } catch (e) {
    logger.error(`[DriverMain] ${e}`);
  }
}

module.exports = {
  buildDriverPanelMessage,
  updateDriverPanel,
  execute
};
