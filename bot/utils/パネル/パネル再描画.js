// src/bot/utils/panelRefresher.js
const path = require("path");
const { readJson } = require("../ストレージ/ストア共通");
const { getPanel } = require("./パネル登録");

const { buildDriverListPanelMessage } = require("../handler/送迎パネル/panel_送迎者一覧パネル");
const { buildDriverShiftPanelMessage } = require("../handler/送迎パネル/panel_送迎者パネル");

const DATA_FILE = path.join(process.cwd(), "data", "drivers.json");

function toDriversArr(db) {
  const drivers = db?.drivers ?? {};
  return Object.values(drivers).map(d => ({
    userId: d.userId,
    mention: `<@${d.userId}>`,
    area: d.area,
    stop: d.stop,
    nick: d.nick,
  }));
}

async function getAvailableCount(db) {
  const drivers = Object.values(db?.drivers ?? {});
  return drivers.filter(d => d.available).length;
}

async function editStoredMessage(client, guildId, key, payloadBuilder) {
  const p = await getPanel(guildId, key);
  if (!p?.channelId || !p?.messageId) return;

  try {
    const ch = await client.channels.fetch(p.channelId);
    const msg = await ch.messages.fetch(p.messageId);
    await msg.edit(payloadBuilder());
  } catch {
    // 消されていたら無視（必要なら panels.json を掃除する）
  }
}

async function refreshDriverListPanel(client, guildId) {
  const db = await readJson(DATA_FILE, { drivers: {} });
  const driversArr = toDriversArr(db);

  await editStoredMessage(client, guildId, "driverList", () => buildDriverListPanelMessage(driversArr, null));
}

async function refreshDriverShiftPanel(client, guildId) {
  const db = await readJson(DATA_FILE, { drivers: {} });
  const count = await getAvailableCount(db);

  await editStoredMessage(client, guildId, "driverShift", () => buildDriverShiftPanelMessage(count));
}

async function refreshAllDriverPanels(client, guildId) {
  await refreshDriverListPanel(client, guildId);
  await refreshDriverShiftPanel(client, guildId);
}

module.exports = {
  refreshDriverListPanel,
  refreshDriverShiftPanel,
  refreshAllDriverPanels,
};