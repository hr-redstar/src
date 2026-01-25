// src/bot/utils/ストレージ/ストア共通.js
require('dotenv').config();
const path = require('path');
const LocalBackend = require('./backends/LocalBackend');
const GCSBackend = require('./backends/GCSBackend');
const logger = require('../logger');

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
 * ストレージエラーを管理者ログスレッドに通知
 */
async function notifyStorageError(operation, key, error, guildId = null) {
  try {
    // ギルドIDが不明な場合はkeyから抽出を試みる
    if (!guildId && key) {
      const match = key.match(/^(?:GCS\/)?(\d+)\//);
      if (match) guildId = match[1];
    }

    if (!guildId) {
      logger.error(`[Storage] ${operation} failed for key: ${key}`, { error: error.message });
      return;
    }

    // Discordクライアントを取得
    const client = global.discordClient;
    if (!client) {
      logger.error(`[Storage] ${operation} failed but no Discord client available`, { key, error: error.message });
      return;
    }

    // 管理者ログスレッドに通知（循環参照を避けるため、直接読み込み）
    const configPath = `${guildId}/config.json`;
    const config = await backend.readJson(configPath, null).catch(() => null);

    if (!config?.logs?.adminLogThread) {
      logger.error(`[Storage] ${operation} failed for key: ${key}`, { error: error.message });
      return;
    }

    const thread = await client.channels.fetch(config.logs.adminLogThread).catch(() => null);
    if (!thread) return;

    await thread.send({
      content: `⚠️ **ストレージ操作エラー**\n**操作**: ${operation}\n**キー**: \`${key}\`\n**エラー**: ${error.message}`,
    }).catch(err => {
      logger.error('[Storage] Failed to send error notification to admin thread', { error: err.message });
    });
  } catch (err) {
    logger.error('[Storage] Error in notifyStorageError', { error: err.message });
  }
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

  try {
    const data = await backend.readJson(key, defaultValue);
    cache.set(key, { data, expiresAt: now + DEFAULT_TTL });
    return data;
  } catch (error) {
    logger.error(`[Storage] readJson failed for key: ${key}`, { error: error.message });
    await notifyStorageError('READ', key, error);
    return defaultValue;
  }
}

async function writeJson(key, data) {
  invalidateCache(key);
  try {
    return await backend.writeJson(key, data);
  } catch (error) {
    logger.error(`[Storage] writeJson failed for key: ${key}`, { error: error.message });
    await notifyStorageError('WRITE', key, error);
    throw error; // 書き込み失敗は致命的なので再スロー
  }
}

async function exists(key) {
  return await backend.exists(key);
}

async function deleteFile(key) {
  invalidateCache(key);
  return await backend.deleteFile(key);
}

async function listKeys(prefix, options) {
  return await backend.listKeys(prefix, options);
}

/**
 * メタデータ付き読み込み (Facade)
 */
async function readJsonWithMeta(key, defaultValue = null) {
  try {
    return await backend.readJsonWithMeta(key, defaultValue);
  } catch (error) {
    logger.error(`[Storage] readJsonWithMeta failed for key: ${key}`, { error: error.message });
    await notifyStorageError('READ_META', key, error);
    return { data: defaultValue, meta: { generation: null } };
  }
}

async function updateJson(key, defaultValue, updaterFn) {
  invalidateCache(key);

  const MAX_RETRIES = 5;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 1. 最新データとメタデータを読み込み
      const { data, meta } = await backend.readJsonWithMeta(key, defaultValue);

      // 2. 更新処理の実行 (updaterFn は純粋関数であることが望ましい)
      const next = await updaterFn(data);

      // 3. 世代番号を指定して書き込み (楽観的ロック)
      await backend.writeJson(key, next, { ifGenerationMatch: meta.generation });

      return next;
    } catch (error) {
      // GCS の 412 Precondition Failed は競合を意味する
      const isConflict = error.code === 412 || error.message?.includes('precondition');

      if (isConflict && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 100; // 200ms, 400ms...
        logger.warn(`[Storage] Conflict detected, retrying... (${attempt}/${MAX_RETRIES}) key: ${key}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // 競合以外、またはリトライ上限到達
      logger.error(`[Storage] updateJson failed for key: ${key} (attempt: ${attempt})`, { error: error.message });
      await notifyStorageError('UPDATE', key, error);
      throw error;
    }
  }
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
  const allKeys = await listKeys(`${guildId}/送迎者`, { recursive: true });
  const profileKeys = allKeys.filter(k => k.endsWith('/登録情報.json'));

  const results = [];
  for (const key of profileKeys) {
    const json = await readJson(key).catch(() => null);
    if (json) {
      results.push(json.current || json);
    }
  }
  return results;
}

/**
 * ギルドの利用者一覧（詳細情報付き）を取得
 */
async function loadUsers(guildId) {
  const allKeys = await listKeys(`${guildId}/利用者`, { recursive: true });
  const profileKeys = allKeys.filter(k => k.endsWith('/登録情報.json'));

  const results = [];
  for (const key of profileKeys) {
    const json = await readJson(key).catch(() => null);
    if (json) {
      results.push(json.current || json);
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
  readJsonWithMeta,
  getBackendName,
  normalizeKey,
  loadDrivers,
  loadUsers,
  listKeys,
};
