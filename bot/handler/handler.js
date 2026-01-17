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
    const key = h.customId || h.id;
    if (key && typeof h.execute === 'function') map.set(key, h);
  }
  return map;
}
const buttonMap = buildButtonMap();

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
    return await interaction.reply(payload);
  } catch (err) {
    logger.error('safeReply 失敗', { error: err.message });
  }
}

async function routeToPanelHandler(interaction, client) {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return;

  // ns（先頭識別子）でルーティング
  // - ps:...        → パネル設置パネル
  // - admin:...     → 管理者パネル
  // - driver:...    → 送迎パネル
  // - user:...      → 利用者パネル
  let handler;

  // ns（先頭識別子）でルーティング
  const ROUTES = {
    adm: () => require('./管理者パネル/メイン'),
    admin: () => require('./管理者パネル/メイン'),
    ps: () => {
      if (parsed.action === 'setup' || parsed.action === 'send') {
        return require('./パネル設置/アクション/パネル設置フロー');
      }
      if (parsed.action === 'check') {
        return require('./パネル設置/アクション/状態確認');
      }
      return null;
    },
    driver: () => require('./送迎パネル/メイン'),
    user: () => require('./利用者パネル/メイン'),
    reg: () => {
      if (parsed.action === 'driver') return require('./登録処理/送迎者登録');
      if (parsed.action === 'user') return require('./登録処理/利用者登録');
      return null;
    },
    ride: () => require('./送迎処理/VCコントロール/VC操作'),
    carpool: () => {
      const action = parsed.action;
      if (action === 'join') {
        return parsed.params?.sub === 'modal'
          ? require('./相乗り/相乗り希望モーダル')
          : require('./相乗り/相乗り希望');
      }
      if (action === 'approve') return require('./相乗り/承認');
      if (action === 'reject') {
        return parsed.params?.sub === 'modal'
          ? require('./相乗り/却下モーダル')
          : require('./相乗り/却下理由選択');
      }
      if (action === 'reject_reason') return require('./相乗り/却下理由処理');
      if (action === 'cancel') return require('./相乗り/相乗りキャンセル');
      return null;
    },
    dispatch: () => {
      if (parsed.action === 'rating') {
        return {
          execute:
            parsed.params?.sub === 'modal'
              ? require('./配車システム/評価システム').handleModalSubmit
              : require('./配車システム/評価システム').execute,
        };
      }
      return require('./配車システム/配車依頼フロー');
    },
    memo: () => {
      if (parsed.action === 'threadpolicy') return require('./メモ管理/スレッドポリシー設定');
      if (parsed.action === 'thread') return require('./メモ管理/スレッド作成');
      return null;
    },
  };

  const getHandler = ROUTES[parsed.namespace];
  handler = getHandler ? getHandler() : null;

  if (!handler || (typeof handler.handle !== 'function' && typeof handler.execute !== 'function')) {
    logger.error('ハンドラーの形式が不正です', {
      customId: interaction.customId,
    });
    return;
  }

  const exec = handler.handle || handler.execute;
  return exec(interaction, client, parsed);
}

async function handleInteraction(interaction, client) {
  try {
    logger.debug('handlerルーティング', {
      customId: interaction.customId,
      type: interaction.type,
      user: `${interaction.user?.tag}(${interaction.user?.id})`,
      guild: interaction.guildId,
    });

    // ====== ★ 追加ここまで ★ ======

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
          if (!interaction.replied && !interaction.deferred) {
            return safeReply(interaction, {
              content: '処理中にエラーが発生しました。',
              flags: MessageFlags.Ephemeral,
            });
          }
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
    logger.error('💥 interaction処理で致命的な例外が発生しました', {
      customId: interaction.customId,
      error: err.stack,
    });
    return safeReply(interaction, {
      content: '❌ 処理中に予期せぬエラーが発生しました。',
      flags: MessageFlags.Ephemeral,
    });
  }
}

module.exports = {
  handleInteraction,
  parseCustomId,
};
