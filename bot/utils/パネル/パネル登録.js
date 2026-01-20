// src/bot/utils/パネル/パネル登録.js
const path = require('path');
const { readJson, writeJson } = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * ギルドごとのパネルメッセージ情報を取得
 */
async function getPanels(guildId) {
  const file = paths.panelsJson(guildId);
  return await readJson(file, {});
}

/**
 * 特定のパネル情報を保存
 */
async function setPanel(guildId, key, channelId, messageId) {
  const file = paths.panelsJson(guildId);
  const db = await readJson(file, {});
  db[key] = {
    channelId,
    messageId,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(file, db);
}

/**
 * 特定のパネル情報を取得
 */
async function getPanel(guildId, key) {
  const panels = await getPanels(guildId);
  return panels[key] || null;
}

module.exports = {
  getPanels,
  setPanel,
  getPanel,
  // 互換性維持のためのエイリアス
  setRideListPanel: (guildId, ch, msg) => setPanel(guildId, 'rideList', ch, msg),
  getRideListPanel: (guildId) => getPanel(guildId, 'rideList'),
};
