// src/bot/utils/logger.js
const util = require("util");

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const LABEL_JP = {
  debug: "デバッグ",
  info: "情報",
  warn: "警告",
  error: "エラー",
};

const ICON = {
  debug: "🧩",
  info: "✅",
  warn: "⚠️",
  error: "💥",
};

function now() {
  // 例: 2025-12-31 16:09:40
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

// Stack を短くする（自分のプロジェクト周辺だけ見たい）
function shortenStack(stack, maxLines = 8) {
  if (!stack) return "";
  const lines = String(stack).split("\n");
  // node_modules を優先的に省く
  const filtered = lines.filter((l) => !l.includes("node_modules"));
  const picked = (filtered.length ? filtered : lines).slice(0, maxLines);
  return picked.join("\n");
}

function formatMeta(meta) {
  if (!meta) return "";
  if (typeof meta === "string") return ` | ${meta}`;
  try {
    return ` | ${util.inspect(meta, { depth: 4, colors: false, compact: true })}`;
  } catch {
    return " | (meta表示失敗)";
  }
}

function formatError(err) {
  if (!err) return "不明なエラー";
  if (typeof err === "string") return err;

  const name = err.name || "Error";
  const msg = err.message || "(messageなし)";

  // cause があるなら要約に入れる
  const cause = err.cause ? ` / 原因: ${err.cause?.message || err.cause}` : "";
  const stack = shortenStack(err.stack);

  return `${name}: ${msg}${cause}${stack ? `\n${stack}` : ""}`;
}

function createLogger(options = {}) {
  const current = LEVELS[options.level || process.env.LOG_LEVEL || "debug"] ?? 10;

  function log(level, message, meta) {
    if ((LEVELS[level] ?? 999) < current) return;

    const line = `[${now()}] ${ICON[level] || ""} [${LABEL_JP[level] || level}] ${message}${formatMeta(meta)}`;
    // error は console.error に
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (m, meta) => log("debug", m, meta),
    info: (m, meta) => log("info", m, meta),
    warn: (m, meta) => log("warn", m, meta),
    error: (m, meta) => log("error", m, meta),
    formatError,
  };
}

module.exports = createLogger();
module.exports.createLogger = createLogger;