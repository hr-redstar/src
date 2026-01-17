const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Client, Collection, GatewayIntentBits, Partials } = require("discord.js");

const logger = require("./utils/logger");

const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  logger.error("❌ DISCORD_TOKEN が .env に設定されていません。");
  process.exit(1);
}

// 必要最低限 + 運用でよく使うものを入れておく
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // ロール付与/確認などで使うことが多い
  ],
  partials: [Partials.Channel],
});

// コマンド格納（interactionCreate 側で参照する想定）
client.commands = new Collection();

/**
 * command/ 配下のコマンドを読み込む（任意：interactionCreate 実装があるなら有効）
 */
function loadCommands() {
  const commandsDir = path.join(__dirname, "command");
  if (!fs.existsSync(commandsDir)) return;

  const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    // 00_パネル設置パネル.js 以外を無視
    if (file !== "00_パネル設置パネル.js") continue;

    const filePath = path.join(commandsDir, file);
    const cmd = require(filePath);

    if (!cmd?.data?.name || typeof cmd.execute !== "function") {
      logger.warn(`⚠️ command 読み込みスキップ: ${file}`);
      continue;
    }
    client.commands.set(cmd.data.name, cmd);
  }

  logger.info(`📦 Commands loaded: ${client.commands.size}`);
}

/**
 * event/ 配下のイベントを読み込む（ready.js / interactionCreate.js 等）
 */
function loadEvents() {
  const eventsDir = path.join(__dirname, "event");
  if (!fs.existsSync(eventsDir)) {
    logger.warn("⚠️ event/ フォルダが見つかりません。");
    return;
  }

  const files = fs.readdirSync(eventsDir).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const filePath = path.join(eventsDir, file);
    const evt = require(filePath);

    if (!evt?.name || typeof evt.execute !== "function") {
      logger.warn(`⚠️ event 読み込みスキップ: ${file}`);
      continue;
    }

    if (evt.once) client.once(evt.name, (...args) => evt.execute(...args, client));
    else client.on(evt.name, (...args) => evt.execute(...args, client));
  }

  logger.info(`🧩 Events loaded: ${files.length}`);
}

// エラーハンドリング
process.on("unhandledRejection", (reason) => {
  logger.error("ハンドルされていないPromiseの拒否", {
    summary: logger.formatError(reason).split("\n")[0],
  });
  logger.debug("詳細(unhandledRejection)", logger.formatError(reason));
});
process.on("uncaughtException", (err) => {
  logger.error("キャッチされていない例外", {
    summary: logger.formatError(err).split("\n")[0],
  });
  logger.debug("詳細(uncaughtException)", logger.formatError(err));
});

loadCommands();
loadEvents();

client.login(token);

module.exports = { client };