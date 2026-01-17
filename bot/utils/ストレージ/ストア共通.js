// src/bot/utils/ストレージ/ストア共通.js
require('dotenv').config();
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

let Storage; // 遅延require
const logger = require('../logger');

const DATA_DIR = process.env.LOCAL_DATA_DIR || path.resolve(__dirname, '../../data');
const USE_LOCAL = process.env.LOCAL_DATA === '1' || !process.env.GCS_BUCKET;

function normalizeKey(key) {
  return String(key)
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

async function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  await fsp.mkdir(dir, { recursive: true });
}

async function readJsonLocal(key, defaultValue = null) {
  const rel = normalizeKey(key);
  const filePath = path.join(DATA_DIR, rel);
  try {
    const buf = await fsp.readFile(filePath);
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return defaultValue;
    throw e;
  }
}

async function writeJsonLocal(key, data) {
  const rel = normalizeKey(key);
  const filePath = path.join(DATA_DIR, rel);
  await ensureDirForFile(filePath);

  const tmpPath = `${filePath}.tmp`;
  const json = JSON.stringify(data, null, 2);
  await fsp.writeFile(tmpPath, json, 'utf8');
  await fsp.rename(tmpPath, filePath);
  return true;
}

async function existsLocal(key) {
  const rel = normalizeKey(key);
  const filePath = path.join(DATA_DIR, rel);
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readJsonGCS(key, defaultValue = null) {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) return defaultValue;

  if (!Storage) ({ Storage } = require('@google-cloud/storage'));
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const objectName = normalizeKey(key);
  const file = bucket.file(objectName);

  try {
    const [exists] = await file.exists();
    if (!exists) return defaultValue;

    const [buf] = await file.download();
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    throw e;
  }
}

async function writeJsonGCS(key, data) {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error('GCS_BUCKET is not set');

  if (!Storage) ({ Storage } = require('@google-cloud/storage'));
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const objectName = normalizeKey(key);
  const file = bucket.file(objectName);

  const json = JSON.stringify(data, null, 2);
  await file.save(Buffer.from(json, 'utf8'), {
    contentType: 'application/json; charset=utf-8',
    resumable: false,
  });
  return true;
}

async function existsGCS(key) {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) return false;

  if (!Storage) ({ Storage } = require('@google-cloud/storage'));
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const objectName = normalizeKey(key);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();

  return exists;
}

async function listKeysLocal(prefix) {
  const rel = normalizeKey(prefix);
  const dirPath = path.join(DATA_DIR, rel);
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true });
    // 再帰的にはとりあえずせず、直下のみ取得する実装
    return entries.filter((e) => e.isFile()).map((e) => normalizeKey(path.join(rel, e.name)));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function listKeysGCS(prefix) {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) return [];

  if (!Storage) ({ Storage } = require('@google-cloud/storage'));
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  // prefix はフォルダパス (末尾 / なしでもOKだが、ある方が安全)
  const p = normalizeKey(prefix);
  const options = {
    prefix: p.endsWith('/') ? p : p + '/',
    delimiter: '/', // 直下のみ
    autoPaginate: true,
  };

  const [files] = await bucket.getFiles(options);
  return files.map((f) => f.name);
}

async function listKeys(prefix) {
  if (USE_LOCAL) return listKeysLocal(prefix);
  return listKeysGCS(prefix);
}

async function readJson(key, defaultValue = null) {
  if (USE_LOCAL) return readJsonLocal(key, defaultValue);
  return readJsonGCS(key, defaultValue);
}

async function writeJson(key, data) {
  if (USE_LOCAL) return writeJsonLocal(key, data);
  return writeJsonGCS(key, data);
}

async function exists(key) {
  if (USE_LOCAL) return existsLocal(key);
  return existsGCS(key);
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

/**
 * ギルドの送迎者一覧（詳細情報付き）を取得
 */
async function loadDrivers(guildId) {
  const root = `GCS/${guildId}/送迎者`;
  const rel = normalizeKey(root);
  const dirPath = path.join(DATA_DIR, rel);

  const results = [];
  if (!USE_LOCAL) {
    // GCSの場合は、プレフィックスを指定して再帰的に取得するのが手っ取り早い
    // (delimiterなしでlistKeys相当を実行)
    const bucketName = process.env.GCS_BUCKET;
    if (!bucketName) return [];
    if (!Storage) ({ Storage } = require('@google-cloud/storage'));
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: rel + '/' });

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      // 名前の末尾が "送迎者.json", "一覧.json", "出勤中.json" などはスキップ
      if (
        file.name.endsWith('送迎者.json') ||
        file.name.endsWith('一覧.json') ||
        file.name.includes('出勤中.json')
      )
        continue;

      const buf = await file.download().catch(() => null);
      if (buf) {
        const json = JSON.parse(buf[0].toString('utf8'));
        results.push(json.current || json);
      }
    }
  } else {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      let json = null;
      if (entry.isDirectory()) {
        // 新形式: 送迎者/ID/登録情報.json
        const profilePath = `${root}/${entry.name}/登録情報.json`;
        json = await readJson(profilePath).catch(() => null);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // 旧形式/互換: 送迎者/ID.json (ただしインデックスやメタは除く)
        if (
          entry.name === '送迎者.json' ||
          entry.name.includes('一覧.json') ||
          entry.name === 'index.json' ||
          entry.name.includes('出勤中')
        )
          continue;
        const profilePath = `${root}/${entry.name}`;
        json = await readJson(profilePath).catch(() => null);
      }

      if (json) {
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
  const rel = normalizeKey(root);
  const dirPath = path.join(DATA_DIR, rel);

  const results = [];
  if (!USE_LOCAL) {
    const bucketName = process.env.GCS_BUCKET;
    if (!bucketName) return [];
    if (!Storage) ({ Storage } = require('@google-cloud/storage'));
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix: rel + '/' });

    for (const file of files) {
      if (!file.name.endsWith('.json')) continue;
      if (file.name.endsWith('利用者.json') || file.name.endsWith('一覧.json')) continue;

      const buf = await file.download().catch(() => null);
      if (buf) {
        const json = JSON.parse(buf[0].toString('utf8'));
        results.push(json.current || json);
      }
    }
  } else {
    if (!fs.existsSync(dirPath)) return [];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      let json = null;
      if (entry.isDirectory()) {
        // 新形式: 利用者/ID/登録情報.json
        const profilePath = `${root}/${entry.name}/登録情報.json`;
        json = await readJson(profilePath).catch(() => null);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        // 旧形式/互換: 利用者/ID.json
        if (
          entry.name === '利用者.json' ||
          entry.name.includes('一覧.json') ||
          entry.name === 'index.json'
        )
          continue;
        const profilePath = `${root}/${entry.name}`;
        json = await readJson(profilePath).catch(() => null);
      }

      if (json) {
        results.push(json.current || json);
      }
    }
  }
  return results;
}

async function deleteFileLocal(key) {
  const rel = normalizeKey(key);
  const filePath = path.join(DATA_DIR, rel);
  try {
    await fsp.unlink(filePath);
    return true;
  } catch (e) {
    if (e.code === 'ENOENT') return true;
    throw e;
  }
}

async function deleteFileGCS(key) {
  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) return true;

  if (!Storage) ({ Storage } = require('@google-cloud/storage'));
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  const objectName = normalizeKey(key);
  const file = bucket.file(objectName);
  await file.delete({ ignoreNotFound: true });
  return true;
}

async function deleteFile(key) {
  if (USE_LOCAL) return deleteFileLocal(key);
  return deleteFileGCS(key);
}

function getAbsolutePath(key) {
  const rel = normalizeKey(key);
  return path.join(DATA_DIR, rel);
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
