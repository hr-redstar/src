// src/bot/utils/ストレージ/backends/LocalBackend.js
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

class LocalBackend {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  normalizeKey(key) {
    return String(key)
      .replace(/^\/+/, '')
      .replace(/\/{2,}/g, '/');
  }

  getAbsolutePath(key) {
    return path.join(this.dataDir, this.normalizeKey(key));
  }

  async ensureDirForFile(filePath) {
    const dir = path.dirname(filePath);
    await fsp.mkdir(dir, { recursive: true });
  }

  async readJson(key, defaultValue = null) {
    const filePath = this.getAbsolutePath(key);
    try {
      const buf = await fsp.readFile(filePath);
      return JSON.parse(buf.toString('utf8'));
    } catch (e) {
      if (e.code === 'ENOENT') return defaultValue;
      throw e;
    }
  }

  async writeJson(key, data) {
    const filePath = this.getAbsolutePath(key);
    await this.ensureDirForFile(filePath);

    const tmpPath = `${filePath}.tmp`;
    const json = JSON.stringify(data, null, 2);
    await fsp.writeFile(tmpPath, json, 'utf8');
    await fsp.rename(tmpPath, filePath);
    return true;
  }

  async exists(key) {
    const filePath = this.getAbsolutePath(key);
    try {
      await fsp.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(key) {
    const filePath = this.getAbsolutePath(key);
    try {
      await fsp.unlink(filePath);
      return true;
    } catch (e) {
      if (e.code === 'ENOENT') return true;
      throw e;
    }
  }

  async listKeys(prefix, { recursive = false } = {}) {
    const rel = this.normalizeKey(prefix);
    const dirPath = path.join(this.dataDir, rel);

    try {
      if (!fs.existsSync(dirPath)) return [];

      const results = [];
      const scan = async (currentPath, currentRel) => {
        const entries = await fsp.readdir(currentPath, { withFileTypes: true });
        for (const entry of entries) {
          const entryRel = path.join(currentRel, entry.name).replace(/\\/g, '/');
          if (entry.isDirectory()) {
            if (recursive) {
              await scan(path.join(currentPath, entry.name), entryRel);
            }
          } else if (entry.isFile()) {
            results.push(entryRel);
          }
        }
      };

      await scan(dirPath, rel);
      return results.map((k) => this.normalizeKey(k));
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }

  /**
   * フォルダ内のエントリ（ファイル/ディレクトリ）を直接取得
   */
  async listEntries(prefix) {
    const rel = this.normalizeKey(prefix);
    const dirPath = path.join(this.dataDir, rel);
    try {
      if (!fs.existsSync(dirPath)) return [];
      return await fsp.readdir(dirPath, { withFileTypes: true });
    } catch (e) {
      if (e.code === 'ENOENT') return [];
      throw e;
    }
  }
}

module.exports = LocalBackend;
