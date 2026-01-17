// src/bot/utils/logger.js
const util = require('util');

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LABEL_JP = {
  debug: 'デバッグ',
  info: '情報',
  warn: '警告',
  error: 'エラー',
};

const ICON = {
  debug: '🧩',
  info: '✅',
  warn: '⚠️',
  error: '💥',
};

function now() {
  // 例: 2025-12-31 16:09:40
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

// Stack を短くする（自分のプロジェクト周辺だけ見たい）
function shortenStack(stack, maxLines = 8) {
  if (!stack) return '';
  const lines = String(stack).split('\n');
  // node_modules を優先的に省く
  const filtered = lines.filter((l) => !l.includes('node_modules'));
  const picked = (filtered.length ? filtered : lines).slice(0, maxLines);
  return picked.join('\n');
}

function formatMeta(meta) {
  if (!meta) return '';
  if (typeof meta === 'string') return ` | ${meta}`;
  try {
    return ` | ${util.inspect(meta, { depth: 4, colors: false, compact: true })}`;
  } catch {
    return ' | (meta表示失敗)';
  }
}

function formatError(err) {
  if (!err) return '不明なエラー';
  if (typeof err === 'string') return err;

  const name = err.name || 'Error';
  const msg = err.message || '(messageなし)';

  // cause があるなら要約に入れる
  const cause = err.cause ? ` / 原因: ${err.cause?.message || err.cause}` : '';
  const stack = shortenStack(err.stack);

  return `${name}: ${msg}${cause}${stack ? `\n${stack}` : ''}`;
}

/**
 * ログの2系統出力
 * - Human-log: console.log/error (開発者向け)
 * - Audit-log: 構造化JSON (監査・監視向け)
 */
function createLogger(options = {}) {
  const currentLevel = LEVELS[options.level || process.env.LOG_LEVEL || 'debug'] ?? 10;
  const isProd = process.env.NODE_ENV === 'production';

  function log(level, message, meta = {}) {
    const levelVal = LEVELS[level] ?? 999;
    if (levelVal < currentLevel) return;

    const timestamp = now();
    const tag = meta.tag || 'SYSTEM';
    const actor = meta.actor || null;
    const guildId = meta.guildId || null;

    // 1. Human-log (Text)
    const icon = ICON[level] || '';
    const label = LABEL_JP[level] || level;
    const metaStr = formatMeta(meta);
    const humanLine = `[${timestamp}] ${icon} [${label}][${tag}] ${message}${metaStr}`;

    if (level === 'error') console.error(humanLine);
    else if (level === 'warn') console.warn(humanLine);
    else console.log(humanLine);

    // 2. Audit-log (JSON)
    const auditData = {
      severity: level.toUpperCase(),
      time: new Date().toISOString(),
      tag,
      message,
      actor,
      guildId,
      ...meta,
    };

    try {
      const json = JSON.stringify(auditData);
      // a. stderr/stdout (Cloud Logging用)
      if (isProd || process.env.ENABLE_AUDIT_LOG === '1') {
        if (level === 'error') process.stderr.write(`${json}\n`);
        else process.stdout.write(`${json}\n`);
      }

      // b. Storage (Bot内部閲覧用)
      if (guildId && (isProd || process.env.ENABLE_STORAGE_LOG === '1')) {
        // 非同期で保存 (awaitしない)
        const { saveAuditLog } = require('./ストレージ/監査ログストア');
        saveAuditLog(guildId, auditData).catch(() => { });
      }
    } catch (e) {
      // JSON 化や保存に失敗した場合は無視
    }
  }

  return {
    debug: (m, meta) => log('debug', m, meta),
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
    formatError,
  };
}

module.exports = createLogger();
module.exports.createLogger = createLogger;

