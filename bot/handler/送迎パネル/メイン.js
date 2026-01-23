﻿﻿﻿// handler/送迎パネル/メイン.js
const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { buildDriverPanelMessage, buildRideListPanelMessage } = require('./埋め込み作成');
const { getQueue } = require('../../utils/配車/待機列マネージャ');

const onAction = require('./アクション/出勤');
const offAction = require('./アクション/退勤');
const locationAction = require('./アクション/現在地更新');

async function updateDriverPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.driverPanel;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  // 待機中の送迎者数をカウント
  const queue = await getQueue(guild.id);
  const waitingCount = queue ? queue.length : 0;

  // 送迎中（実車中）の送迎車数をカウント
  const activeDispatchDir = paths.activeDispatchDir(guild.id);
  const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);
  // ファイルの中身を読んでdriverIdのユニーク数を数える (より正確な方法)
  const activeDispatches = await Promise.all(
    activeFiles
      .filter((f) => f.endsWith('.json'))
      .map((f) => store.readJson(f).catch(() => null))
  );
  const validDispatches = activeDispatches.filter((d) => d && d.driverId);
  const workingDriverIds = [...new Set(validDispatches.map((d) => d.driverId))];
  const workingCount = workingDriverIds.length;

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

async function updateRideListPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.rideListPanel;

  if (!panel || !panel.channelId) return;

  const channel =
    guild.channels.cache.get(panel.channelId) ||
    (await guild.channels.fetch(panel.channelId).catch(() => null));
  if (!channel) return;

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: () => buildRideListPanelMessage(guild, client),
    suppressFallback: true, // 自動更新時は勝手に再送しない
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    config.panels.rideListPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

/**
 * 関連する送迎パネル群をまとめて更新する
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 */
function updateRelevantPanels(guild, client) {
  // 更新処理は非同期で実行し、完了を待たない（fire and forget）
  Promise.all([updateDriverPanel(guild, client), updateRideListPanel(guild, client)]).catch((err) =>
    logger.error('パネルの更新に失敗しました。', { error: err, guildId: guild.id })
  );
}

// ===== Handler =====
async function execute(interaction, client, parsed) {
  const action = parsed?.action;

  // アクションの実行
  if (action === 'on') {
    await onAction(interaction, client, parsed);
  } else if (action === 'off') {
    await offAction(interaction, client, parsed);
  } else if (action === 'location') {
    // 現在地更新処理（完了後にパネル更新が必要な場合があるため、更新関数を渡す）
    return locationAction(interaction, client, parsed, () => updateRelevantPanels(interaction.guild, client));
  } else {
    // 不明なアクションの場合は何もしない
    return;
  }

  // 出勤・退勤処理後にパネルを更新
  updateRelevantPanels(interaction.guild, client);
}

module.exports = {
  buildDriverPanelMessage,
  updateDriverPanel,
  updateRideListPanel,
  updateRelevantPanels,
  execute,
  buildRideListPanelMessage,
};
