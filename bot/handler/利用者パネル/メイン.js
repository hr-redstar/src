// handler/利用者パネル/メイン.js
const logger = require('../../utils/logger');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { buildUserPanelMessage } = require('./埋め込み作成');
const { getQueue } = require('../../utils/配車/待機列マネージャ');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;
const statusCheckAction = require('../パネル設置/アクション/状態確認');

async function updateUserPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.userPanel;

  if (!panel || !panel.channelId) return;

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
    `[UserPanel] Active Drivers: ${activeCount} (Waiting: ${waitingCount}, Working: ${workingCount})`,
    { guildId: guild.id }
  );

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildUserPanelMessage(guild, activeCount, client),
    suppressFallback: true,
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.userPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

// ===== Handler =====
async function execute(interaction, client, parsed) {
  const action = parsed?.action;
  const sub = parsed?.params?.sub;

  if (action === 'ride') {
    if (sub === 'request') return require('./アクション/送迎依頼')(interaction, client, parsed);
    if (sub === 'guest') return require('./アクション/ゲスト送迎依頼')(interaction, client, parsed);
    if (sub === 'request_modal' || sub === 'guest_modal') {
      return require('./アクション/送迎依頼モーダル')(interaction, client, parsed);
    }
  }
  // 状態確認
  if (action === 'check') return statusCheckAction.execute(interaction, client, parsed);
}

module.exports = {
  buildUserPanelMessage,
  updateUserPanel,
  execute,
};
