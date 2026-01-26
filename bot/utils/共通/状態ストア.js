// utils/共通/状態ストア.js
// guildごとの状態をJSONに保存（再起動しても維持）

const store = require('../ストレージ/ストア共通');

const STATE_KEY = 'state.json';

async function loadAll() {
  const data = await store.readJson(STATE_KEY, { guilds: {} });
  if (!data.guilds) data.guilds = {};
  return data;
}

async function saveAll(data) {
  await store.writeJson(STATE_KEY, data);
}

async function getGuildState(guildId) {
  const all = await loadAll();
  if (!all.guilds[guildId]) {
    all.guilds[guildId] = {
      driversAvailable: {}, // { userId: true }
      driverPanelMessages: [], // [{ channelId, messageId }]
    };
    await saveAll(all);
  }
  return { all, state: all.guilds[guildId] };
}

async function updateGuildState(guildId, fn) {
  const { all, state } = await getGuildState(guildId);
  const updated = fn(state) || state;
  all.guilds[guildId] = updated;
  await saveAll(all);
  return updated;
}

module.exports = {
  getGuildState,
  updateGuildState,
};
