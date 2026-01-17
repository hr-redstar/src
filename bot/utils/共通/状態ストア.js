// src/bot/utils/stateStore.js
// guildごとの状態をJSONに保存（再起動しても維持）

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'src', 'bot', 'data');
const FILE_PATH = path.join(DATA_DIR, 'state.json');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE_PATH))
    fs.writeFileSync(FILE_PATH, JSON.stringify({ guilds: {} }, null, 2), 'utf8');
}

function loadAll() {
  ensureFile();
  try {
    const raw = fs.readFileSync(FILE_PATH, 'utf8');
    const json = JSON.parse(raw);
    if (!json.guilds) json.guilds = {};
    return json;
  } catch {
    return { guilds: {} };
  }
}

function saveAll(data) {
  ensureFile();
  fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function getGuildState(guildId) {
  const all = loadAll();
  if (!all.guilds[guildId]) {
    all.guilds[guildId] = {
      driversAvailable: {}, // { userId: true }
      driverPanelMessages: [], // [{ channelId, messageId }]
    };
    saveAll(all);
  }
  return { all, state: all.guilds[guildId] };
}

function updateGuildState(guildId, fn) {
  const { all, state } = getGuildState(guildId);
  const updated = fn(state) || state;
  all.guilds[guildId] = updated;
  saveAll(all);
  return updated;
}

module.exports = {
  getGuildState,
  updateGuildState,
  FILE_PATH,
};
