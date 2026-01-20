const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Client, Collection, GatewayIntentBits, Partials, Events } = require('discord.js');

const logger = require('./utils/logger');

const token = process.env.DISCORD_TOKEN?.trim();
if (!token) {
  logger.error('❌ DISCORD_TOKEN が .env に設定されていません。');
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

// Discord Client が ready になったらグローバル登録
client.once(Events.ClientReady, () => {
  global.discordClient = client;
  logger.debug('🌐 discordClient を global に登録しました');
});

/**
 * command/ 配下のコマンドを非同期読み込み
 */
async function loadCommands() {
  const commandsDir = path.join(__dirname, 'command');
  if (!fs.existsSync(commandsDir)) return;

  try {
    // recursive: true でサブディレクトリも検索可能にする (Node.js 18+)
    const files = await fs.promises.readdir(commandsDir, { recursive: true });
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    for (const file of jsFiles) {
      // path.basenameを使って、サブディレクトリ内の _file.js もスキップできるようにする
      if (path.basename(file).startsWith('_')) continue;

      const filePath = path.join(commandsDir, file);
      const cmd = require(filePath);

      if (cmd.disabled) continue;

      if (!cmd?.data?.name || typeof cmd.execute !== 'function') {
        logger.warn(`⚠️ command 読み込みスキップ: ${file}`);
        continue;
      }
      client.commands.set(cmd.data.name, cmd);
    }
    logger.info(`📦 Commands loaded: ${client.commands.size}`);
  } catch (err) {
    logger.error('コマンド読み込みエラー', err);
  }
}

/**
 * event/ 配下のイベントを非同期読み込み
 */
async function loadEvents() {
  const eventsDir = path.join(__dirname, 'event');
  if (!fs.existsSync(eventsDir)) {
    logger.warn('⚠️ event/ フォルダが見つかりません。');
    return;
  }

  try {
    // recursive: true を追加してイベントもサブディレクトリ対応にする
    const files = await fs.promises.readdir(eventsDir, { recursive: true });
    const jsFiles = files.filter((f) => f.endsWith('.js'));

    for (const file of jsFiles) {
      const filePath = path.join(eventsDir, file);
      const evt = require(filePath);

      if (!evt?.name || typeof evt.execute !== 'function') {
        logger.warn(`⚠️ event 読み込みスキップ: ${file}`);
        continue;
      }

      if (evt.once) client.once(evt.name, (...args) => evt.execute(...args, client));
      else client.on(evt.name, (...args) => evt.execute(...args, client));
    }
    logger.info(`🧩 Events loaded: ${jsFiles.length}`);
  } catch (err) {
    logger.error('イベント読み込みエラー', err);
  }
}

// エラーハンドリング
const formatError = (err) => (logger.formatError ? logger.formatError(err) : String(err));

process.on('unhandledRejection', (reason) => {
  logger.error('ハンドルされていないPromiseの拒否', {
    summary: formatError(reason).split('\n')[0],
  });
  logger.debug('詳細(unhandledRejection)', formatError(reason));
});
process.on('uncaughtException', (err) => {
  logger.error('キャッチされていない例外', {
    summary: formatError(err).split('\n')[0],
  });
  logger.debug('詳細(uncaughtException)', formatError(err));
});

// メイン実行関数
async function main() {
  await loadCommands();
  await loadEvents();
  await client.login(token);

  // 起動後の整合性チェック
  client.once(Events.ClientReady, async () => {
    const { loadConfig } = require('./utils/設定/設定マネージャ');
    const { checkConfigIntegrity } = require('./utils/設定/configIntegrityCheck');

    // 複数のギルドに対応する場合を考慮しつつ、まずは主力の設定をロードしてチェック
    const guilds = client.guilds.cache;
    for (const [guildId, guild] of guilds) {
      const config = await loadConfig(guildId).catch(() => null);
      if (config) {
        await checkConfigIntegrity(guild, config).catch((err) => {
          logger.error(`❌ 設定整合性チェック中にエラーが発生しました (Guild: ${guildId})`, err);
        });
      }
    }
  });
}

// Graceful Shutdown: シグナルを受け取って安全に終了する
const shutdown = (signal) => {
  logger.info(`${signal} 受信。シャットダウンを開始します...`);
  client.destroy();
  logger.info('Botクライアントを切断しました。');
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  logger.error('起動時エラー', err);
  process.exit(1);
});

module.exports = { client };
