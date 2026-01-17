// src/bot/utils/ストレージ/backends/GCSBackend.js
let Storage; // 遅延 require

class GCSBackend {
  constructor(bucketName) {
    this.bucketName = bucketName;
  }

  normalizeKey(key) {
    return String(key)
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');
  }

  getBucket() {
    if (!this.bucketName) throw new Error('GCS_BUCKET is not set');
    if (!Storage) ({ Storage } = require('@google-cloud/storage'));
    const storage = new Storage();
    return storage.bucket(this.bucketName);
  }

  async readJson(key, defaultValue = null) {
    const bucket = this.getBucket();
    const objectName = this.normalizeKey(key);
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

  async writeJson(key, data) {
    const bucket = this.getBucket();
    const objectName = this.normalizeKey(key);
    const file = bucket.file(objectName);

    const json = JSON.stringify(data, null, 2);
    await file.save(Buffer.from(json, 'utf8'), {
      contentType: 'application/json; charset=utf-8',
      resumable: false,
    });
    return true;
  }

  async exists(key) {
    const bucket = this.getBucket();
    const objectName = this.normalizeKey(key);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    return exists;
  }

  async deleteFile(key) {
    const bucket = this.getBucket();
    const objectName = this.normalizeKey(key);
    const file = bucket.file(objectName);
    await file.delete({ ignoreNotFound: true });
    return true;
  }

  async listKeys(prefix, { recursive = false } = {}) {
    const bucket = this.getBucket();
    const p = this.normalizeKey(prefix);
    const options = {
      prefix: p.endsWith('/') ? p : p + '/',
      autoPaginate: true,
    };

    if (!recursive) {
      options.delimiter = '/';
    }

    const [files] = await bucket.getFiles(options);
    return files.map((f) => this.normalizeKey(f.name));
  }
}

module.exports = GCSBackend;
