// src/bot/utils/ストレージ/ストア共通.js
require('dotenv').config();
const path = require('path');
const LocalBackend = require('./backends/LocalBackend');
const GCSBackend = require('./backends/GCSBackend');

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.resolve(__dirname, '../../data');
const USE_LOCAL = process.env.LOCAL_DATA === '1' || !process.env.GCS_BUCKET;

// バックエンドのインスタンス化
const backend = USE_LOCAL ? new LocalBackend(DATA_DIR) : new GCSBackend(process.env.GCS_BUCKET);

/**
 * 基本的な JSON 操作 (ファサード)
 */
async function readJson(key, defaultValue = null) {
  return await backend.readJson(key, defaultValue);
}

async function writeJson(key, data) {
  return await backend.writeJson(key, data);
}

async function exists(key) {
  return await backend.exists(key);
}

async function deleteFile(key) {
  return await backend.deleteFile(key);
}

async function listKeys(prefix) {
  return await backend.listKeys(prefix);
}

async function updateJson(key, defaultValue, updaterFn) {
  const cur = await readJson(key, defaultValue);
  const next = await updaterFn(cur);
  await writeJson(key, next);
  return next;
}

function getBackendName() {
  return USE_LOCAL ? `local(${DATA_DIR})` : `gcs(${process.env.GCS_BUCKET})`;
}

const normalizeKey = (key) => backend.normalizeKey(key);
const getAbsolutePath = (key) => (USE_LOCAL ? backend.getAbsolutePath(key) : null);

/**
 * ギルドの送迎者一覧（詳細情報付き）を取得
 */
async function loadDrivers(guildId) {
  const root = `GCS/${guildId}/送迎者`;
  const results = [];

  if (USE_LOCAL) {
    const entries = await backend.listEntries(root);
    for (const entry of entries) {
      let json = null;
      if (entry.isDirectory()) {
        const profilePath = `${root}/${entry.name}/登録情報.json`;
        json = await readJson(profilePath).catch(() => null);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        if (
          ['送迎者.json', 'index.json'].some((s) => entry.name.includes(s)) ||
          entry.name.includes('一覧') ||
          entry.name.includes('出勤中')
        )
          continue;
        json = await readJson(`${root}/${entry.name}`).catch(() => null);
      }
      if (json) results.push(json.current || json);
    }
  } else {
    const files = await backend.listAllFiles(root);
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      if (['送迎者.json', '一覧.json', '出勤中.json'].some((s) => file.name.endsWith(s))) continue;

      const [buf] = await file.download().catch(() => [null]);
      if (buf) {
        const json = JSON.parse(buf.toString('utf8'));
        results.push(json.current || json);
      }
    }
  }
  return results;
}

/**
 * ギルドの利用者一覧（詳細情報付き）を取得
 */
async function loadUsers(guildId) {
  const root = `GCS/${guildId}/利用者`;
  const results = [];

  if (USE_LOCAL) {
    const entries = await backend.listEntries(root);
    for (const entry of entries) {
      let json = null;
      if (entry.isDirectory()) {
        const profilePath = `${root}/${entry.name}/登録情報.json`;
        json = await readJson(profilePath).catch(() => null);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        if (['利用者.json', '一覧.json', 'index.json'].some((s) => entry.name.includes(s)))
          continue;
        json = await readJson(`${root}/${entry.name}`).catch(() => null);
      }
      if (json) results.push(json.current || json);
    }
  } else {
    const files = await backend.listAllFiles(root);
    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      if (['利用者.json', '一覧.json'].some((s) => file.name.endsWith(s))) continue;

      const [buf] = await file.download().catch(() => [null]);
      if (buf) {
        const json = JSON.parse(buf.toString('utf8'));
        results.push(json.current || json);
      }
    }
  }
  return results;
}

module.exports = {
  readJson,
  writeJson,
  exists,
  deleteFile,
  getAbsolutePath,
  updateJson,
  getBackendName,
  normalizeKey,
  loadDrivers,
  loadUsers,
  listKeys,
};
