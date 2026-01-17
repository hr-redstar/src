// src/bot/utils/ストレージ/ストア共通.js
require('dotenv').config();
const path = require('path');
const LocalBackend = require('./backends/LocalBackend');
const GCSBackend = require('./backends/GCSBackend');

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.resolve(__dirname, '../../data');
const USE_LOCAL = process.env.LOCAL_DATA === '1' || !process.env.GCS_BUCKET;

// バックエンドのインスタンス化
const backend = USE_LOCAL ? new LocalBackend(DATA_DIR) : new GCSBackend(process.env.GCS_BUCKET);

// インメモリキャッシュ (TTL付き)
const cache = new Map(); // key -> { data, expiresAt }
const DEFAULT_TTL = 10000; // 10秒

function invalidateCache(key) {
  cache.delete(key);
}

/**
 * 基本的な JSON 操作 (ファサード)
 */
async function readJson(key, defaultValue = null) {
  const now = Date.now();
  const entry = cache.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  const data = await backend.readJson(key, defaultValue);
  cache.set(key, { data, expiresAt: now + DEFAULT_TTL });
  return data;
}

async function writeJson(key, data) {
  invalidateCache(key);
  return await backend.writeJson(key, data);
}

async function exists(key) {
  return await backend.exists(key);
}

async function deleteFile(key) {
  invalidateCache(key);
  return await backend.deleteFile(key);
}

async function listKeys(prefix) {
  return await backend.listKeys(prefix);
}

async function updateJson(key, defaultValue, updaterFn) {
  invalidateCache(key);
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
 * 汎用的な JSON オブジェクトリスト取得 (バックエンド非依存)
 */
async function listAllJsonObjects(root, excludePatterns = []) {
  const keys = await listKeys(root, { recursive: true });
  const results = [];

  for (const key of keys) {
    if (!key.endsWith('.json')) continue;
    if (excludePatterns.some((pattern) => key.includes(pattern))) continue;

    const json = await readJson(key).catch(() => null);
    if (json) {
      results.push(json.current || json);
    }
  }
  return results;
}

/**
 * ギルドの送迎者一覧（詳細情報付き）を取得
 */
async function loadDrivers(guildId) {
  return await listAllJsonObjects(`GCS/${guildId}/送迎者`, [
    '送迎者.json',
    '一覧.json',
    '出勤中.json',
    'index.json',
  ]);
}

/**
 * ギルドの利用者一覧（詳細情報付き）を取得
 */
async function loadUsers(guildId) {
  return await listAllJsonObjects(`GCS/${guildId}/利用者`, [
    '利用者.json',
    '一覧.json',
    'index.json',
  ]);
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
