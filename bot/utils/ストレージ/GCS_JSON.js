// src/bot/utils/gcsJson.js
require('dotenv').config();

const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'src', 'bot', 'data');
const MODE = (process.env.STORAGE_MODE || 'local').toLowerCase(); // local | gcs

async function ensureLocalFile(localPath, defaultValue) {
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  try {
    await fs.access(localPath);
  } catch {
    await fs.writeFile(localPath, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

async function readLocalJson(localPath, defaultValue) {
  await ensureLocalFile(localPath, defaultValue);
  const raw = await fs.readFile(localPath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
}

async function writeLocalJson(localPath, data) {
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const tmp = localPath + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, localPath);
}

const prefix = process.env.GCS_PREFIX || 'shuttlebot/';

function getGcs() {
  // MODE が gcs じゃないなら絶対にGCSを使わない
  if (MODE !== 'gcs') return null;

  const bucketName = process.env.GCS_BUCKET;
  if (!bucketName) throw new Error('GCS_BUCKET is required when STORAGE_MODE=gcs');

  // gcsモードのときだけ require する（localでは依存不要）
  // eslint-disable-next-line global-require
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  return { bucket, prefix };
}

async function readGcsJson(key, defaultValue) {
  const gcs = getGcs();
  if (!gcs) return null;

  const file = gcs.bucket.file(gcs.prefix + key);
  try {
    const [exists] = await file.exists();
    if (!exists) return defaultValue;

    const [buf] = await file.download();
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return defaultValue;
  }
}

async function writeGcsJson(key, data) {
  const gcs = getGcs();
  if (!gcs) return false;

  const file = gcs.bucket.file(gcs.prefix + key);
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  await file.save(body, { contentType: 'application/json' });
  return true;
}

async function readJson(key, defaultValue) {
  // gcsモードならGCS、localモードならローカル
  const gcsData = await readGcsJson(key, null);
  if (gcsData !== null) return gcsData;

  const localPath = path.join(DATA_DIR, key);
  return readLocalJson(localPath, defaultValue);
}

async function writeJson(key, data) {
  const ok = await writeGcsJson(key, data).catch(() => false);
  if (ok) return;

  const localPath = path.join(DATA_DIR, key);
  await writeLocalJson(localPath, data);
}

async function deleteGcsFolder(prefix) {
  const gcs = getGcs();
  if (!gcs) return false;

  try {
    await gcs.bucket.deleteFiles({ prefix: gcs.prefix + prefix });
    return true;
  } catch (e) {
    console.error(`[gcsJson] Failed to delete GCS folder: ${prefix}`, e);
    return false;
  }
}

async function deleteLocalFolder(key) {
  const localPath = path.join(DATA_DIR, key);
  try {
    await fs.rm(localPath, { recursive: true, force: true });
    return true;
  } catch (e) {
    // ENOENT is fine (already deleted)
    if (e.code !== 'ENOENT') {
      console.error(`[gcsJson] Failed to delete local folder: ${localPath}`, e);
    }
    return false;
  }
}

async function deleteFolder(key) {
  if (MODE === 'gcs') {
    return await deleteGcsFolder(key);
  }
  return await deleteLocalFolder(key);
}

module.exports = { readJson, writeJson, deleteFolder, prefix };
