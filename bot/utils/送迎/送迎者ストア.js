// utils/送迎/送迎者ストア.js
const { readJson, writeJson, prefix } = require('../ストレージ/GCS_JSON');
const { driversIndexPath, driverRegPath } = require('../ストレージ/GCSパス');

function defIndex() {
  return { version: 1, updatedAt: 0, drivers: {} };
}

async function getDrivers(guildId) {
  // 一覧インデックスを取得
  const path = driversIndexPath(prefix, guildId);
  const idx = (await readJson(path)) ?? defIndex();
  return idx;
}

async function registerDriver(guildId, userId, { area, stop, nickname }) {
  const now = Math.floor(Date.now() / 1000);

  // 1) 個別登録情報 (送迎者/<userId>/登録情報.json)
  const regPath = driverRegPath(prefix, guildId, userId);
  const oldReg = (await readJson(regPath)) || {};

  const newReg = {
    userId,
    area,
    stop,
    nickname,
    createdAt: oldReg.createdAt ?? now,
    updatedAt: now,
  };
  await writeJson(regPath, newReg);

  // 2) 一覧インデックス (送迎者.json)
  const idxPath = driversIndexPath(prefix, guildId);
  const idx = (await readJson(idxPath)) ?? defIndex();

  idx.drivers[userId] = { area, stop, nickname, updatedAt: now };
  idx.updatedAt = now;
  await writeJson(idxPath, idx);

  return idx;
}

async function deleteDriver(guildId, userId) {
  const idxPath = driversIndexPath(prefix, guildId);
  const idx = (await readJson(idxPath)) ?? defIndex();

  if (idx.drivers[userId]) {
    delete idx.drivers[userId];
    idx.updatedAt = Math.floor(Date.now() / 1000);
    await writeJson(idxPath, idx);
  }
  return idx;
}

module.exports = { getDrivers, registerDriver, deleteDriver };
