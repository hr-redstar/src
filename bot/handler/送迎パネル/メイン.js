// handler/送迎パネル/メイン.js
const logger = require('../../utils/logger');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { buildDriverPanelMessage } = require('./埋め込み作成');
const { getQueue } = require('../../utils/配車/待機列マネージャ');

async function updateDriverPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.driverPanel;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  // 待機中の送迎者数をカウント
  const { getQueue } = require('../../utils/配車/待機列マネージャ');
  const queue = await getQueue(guild.id);
  const waitingCount = queue ? queue.length : 0;

  // 送迎中（実車中）の送迎車数をカウント
  const activeDispatchDir = paths.activeDispatchDir(guild.id);
  const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
  const workingCount = activeFiles.filter((f) => f.endsWith('.json')).length;

  const activeCount = waitingCount + workingCount;

  logger.debug(
    `[DriverPanel] Active Drivers: ${activeCount} (Waiting: ${waitingCount}, Working: ${workingCount})`,
    { guildId: guild.id }
  );

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
async function execute(interaction, client, parsed) {
  const action = parsed?.action;

  if (action === 'on') return require('./アクション/出勤')(interaction, client, parsed);
  if (action === 'off') return require('./アクション/退勤')(interaction, client, parsed);
  if (action === 'location') return require('./アクション/現在地更新')(interaction, client, parsed);
}

module.exports = {
  buildDriverPanelMessage,
  updateDriverPanel,
  execute,
};
