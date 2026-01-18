// src/bot/handler/handler.js
// interaction を種類ごとに振り分け → customId なら各パネルの index.js に委譲
const { MessageFlags } = require('discord.js');
const logger = require('../utils/logger');
const { parseCustomId } = require('../utils/parseCustomId');

// パネル設置のハンドラー群を一括読み込み
const panelSetup = require('./パネル設置');

function buildButtonMap() {
  const map = new Map();
  // ここに他カテゴリの handlers も足していく想定
  const all = [...(panelSetup.handlers ?? [])];
  for (const h of all) {
    if (!h) continue;
    const key = h.customId || h.id;
    if (key && typeof h.execute === 'function') map.set(key, h);
  }
  return map;
}
const buttonMap = buildButtonMap();

const { resolvePanelHandler } = require('./panelRouter');

async function routeToPanelHandler(interaction, client) {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return;

  const handler = resolvePanelHandler(parsed);

  if (!handler || (typeof handler.handle !== 'function' && typeof handler.execute !== 'function')) {
    logger.error('ハンドラーの形式が不正です', {
      customId: interaction.customId,
    });
    return;
  }

  const exec = handler.handle || handler.execute;
  return exec(interaction, client, parsed);
}

const { logAdminInteraction } = require('../utils/log/adminInteractionLogger');

async function handleInteraction(interaction, client) {
  try {
    // 全インタラクションの開始を管理ログに記録 (監査用) - 非同期で実行し、メイン処理をブロックしない
    logAdminInteraction(interaction, 'START').catch((err) => {
      logger.error('管理者ログ送信エラー(START)', { error: err.message });
    });

    const { MessageFlags } = require('discord.js');

    logger.debug('handlerルーティング', {
      customId: interaction.customId,
      type: interaction.type,
      user: interaction.user ? `${interaction.user.tag}(${interaction.user.id})` : 'unknown',
      guild: interaction.guildId,
    });

    // Slash Command
    if (interaction.isChatInputCommand()) {
      const cmd = client.commands?.get(interaction.commandName);
      if (!cmd?.execute) {
        return interaction.reply({
          content: '未登録のコマンドです。',
          flags: MessageFlags.Ephemeral,
        });
      }
      return await cmd.execute(interaction, client);
    }

    // ユーザー確認パネル
    // Button / Select Menu / Modal
    if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
      // 1. Map Lookup (優先)
      const h = buttonMap.get(interaction.customId);
      if (h) {
        try {
          return await h.execute(interaction, client);
        } catch (err) {
          // 実行中エラーも拾う
          logger.error('handlerMap execute error', {
            customId: interaction.customId,
            error: err.message,
          });
          // 管理ログへもエラー通知
          await logAdminInteraction(interaction, 'ERROR', { message: `HandlerMap Error: ${err.message}` });
          return;
        }
      }

      // 2. Map になければ、customId をパースしてルーティング
      return await routeToPanelHandler(interaction, client);
    }

    // Autocomplete
    if (interaction.isAutocomplete?.()) {
      const cmd = client.commands?.get(interaction.commandName);
      if (cmd?.autocomplete) return await cmd.autocomplete(interaction, client);
      return;
    }

    // それ以外の無視
  } catch (err) {
    // 致命的エラーを管理ログに記録
    await logAdminInteraction(interaction, 'ERROR', {
      message: `Fatal Error: ${err.message}`,
    });

    logger.error('💥 interaction処理で致命的な例外が発生しました', {
      customId: interaction.customId,
      error: err.stack,
    });
    // ここでの safeReply も削除。ACK 責務は各ハンドラのテンプレートへ統合済み。
  }
}

module.exports = {
  handleInteraction,
  parseCustomId,
};
