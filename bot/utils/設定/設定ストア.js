const { prefix, readJson, writeJson } = require("../ストレージ/GCS_JSON");
const { configPath } = require("../ストレージ/GCSパス");

const cache = new Map();

function defaultConfig() {
  return {
    version: 1,
    roles: {
      driver: [],        // 送迎者ロール（複数）
      customer: [],      // 利用者ロール（複数）
      driverMention: [],
      customerMention: [],
    },
    channels: {
      adminLogChannelId: null, // 管理者ログチャンネル
      globalLogChannelId: null,
      rideShareChannelId: null,
    },
    panels: {
      driverRegPanel: { channelId: null, messageId: null },
      driverListPanel: { channelId: null, messageId: null },
      driverPanel: { channelId: null, messageId: null },
    },
    runtime: {
      // 今から行けますを押している送迎者
      onDutyDrivers: {
        // "<userId>": { location: "現在地", since: 1730000000 }
      },
    },
  };
}

function strip(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  delete c.__init;
  return c;
}

async function getConfig(guildId) {
  if (cache.has(guildId)) return cache.get(guildId);

  const p = configPath(prefix, guildId);
  const cfg = (await readJson(p)) ?? defaultConfig();
  cache.set(guildId, cfg);

  if (!cfg.__init) {
    cfg.__init = true;
    await writeJson(p, strip(cfg));
  }
  return cfg;
}

async function saveConfig(guildId, cfg) {
  cache.set(guildId, cfg);
  const p = configPath(prefix, guildId);
  await writeJson(p, strip(cfg));
}

module.exports = { getConfig, saveConfig };