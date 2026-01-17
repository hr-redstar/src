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

    async _withRetry(fn, maxRetries = 2) {
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (e) {
                if (i === maxRetries || !this._isRetryable(e)) throw e;
                const delay = Math.pow(2, i) * 200; // 200ms, 400ms...
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }

    _isRetryable(e) {
        // ネットワークエラー、または 5xx エラーを再試行対象とする
        if (!e) return false;
        const code = e.code || (e.response && e.response.status);
        if (code >= 500 && code < 600) return true;
        if (['ETIMEDOUT', 'ECONNRESET', 'EADDRINUSE', 'ECONNREFUSED'].includes(e.code)) return true;
        return false;
    }

    async readJson(key, defaultValue = null) {
        return this._withRetry(async () => {
            const bucket = this.getBucket();
            const objectName = this.normalizeKey(key);
            const file = bucket.file(objectName);

            const [exists] = await file.exists();
            if (!exists) return defaultValue;

            const [buf] = await file.download();
            return JSON.parse(buf.toString('utf8'));
        });
    }

    async writeJson(key, data) {
        return this._withRetry(async () => {
            const bucket = this.getBucket();
            const objectName = this.normalizeKey(key);
            const file = bucket.file(objectName);

            const json = JSON.stringify(data, null, 2);
            await file.save(Buffer.from(json, 'utf8'), {
                contentType: 'application/json; charset=utf-8',
                resumable: false,
            });
            return true;
        });
    }

    async exists(key) {
        return this._withRetry(async () => {
            const bucket = this.getBucket();
            const objectName = this.normalizeKey(key);
            const file = bucket.file(objectName);

            const [exists] = await file.exists();
            return exists;
        });
    }

    async deleteFile(key) {
        return this._withRetry(async () => {
            const bucket = this.getBucket();
            const objectName = this.normalizeKey(key);
            const file = bucket.file(objectName);
            await file.delete({ ignoreNotFound: true });
            return true;
        });
    }

    async listKeys(prefix, { recursive = false } = {}) {
        return this._withRetry(async () => {
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
        });
    }
}

module.exports = GCSBackend;
