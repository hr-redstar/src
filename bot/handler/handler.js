// src/bot/handler/handler.js
// interaction を種類ごとに振り分け → customId なら各パネルの index.js に委譲
const { MessageFlags } = require("discord.js");
const logger = require("../utils/logger");
const { parseCustomId } = require("../utils/parseCustomId");

// パネル設置のハンドラー群を一括読み込み
const panelSetup = require("./パネル設置");

function buildButtonMap() {
  const map = new Map();
  // ここに他カテゴリの handlers も足していく想定
  const all = [
    ...(panelSetup.handlers ?? []),
  ];
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
  } catch (_) { }
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

  switch (parsed.namespace) {
    case "admin":
    case "adm":
      handler = require("./管理者パネル/メイン");
      break;
    case "ps":
      if (parsed.action === 'setup' || (parsed.legacy && parsed.action === 'send')) {
        handler = require('./パネル設置/アクション/パネル設置フロー');
      }
      if (parsed.action === 'check') {
        handler = require('./パネル設置/アクション/状態確認');
      }
      break;
    case "driver":
      handler = require("./送迎パネル/メイン");
      break;
    case "user":
      handler = require("./利用者パネル/メイン");
      break;
    case "reg":
      if (parsed.action === 'driver') handler = require("./登録処理/送迎者登録");
      if (parsed.action === 'user') handler = require("./登録処理/利用者登録");
      break;
    case "ride":
      // VC操作(approach, start, end, extend)
      handler = require("./送迎処理/VCコントロール/VC操作");
      break;
    case "carpool":
      // 相乗り系 (join, approve, reject, cancel)
      const action = parsed.action;
      if (action === 'join') {
        if (parsed.params?.sub === 'modal') handler = require("./相乗り/相乗り希望モーダル");
        else handler = require("./相乗り/相乗り希望");
      }
      if (action === 'approve') handler = require("./相乗り/承認");
      if (action === 'reject') {
        if (parsed.params?.sub === 'modal') handler = require("./相乗り/却下モーダル");
        else handler = require("./相乗り/却下理由選択");
      }
      if (action === 'reject_reason') handler = require("./相乗り/却下理由処理");
      if (action === 'cancel') handler = require("./相乗り/相乗りキャンセル");
      break;
    case "dispatch":
      if (parsed.action === 'rating') {
        if (parsed.params?.sub === 'modal') handler = require("./配車システム/評価システム").handleModalSubmit;
        else handler = require("./配車システム/評価システム").execute;
      } else {
        handler = require("./配車システム/配車依頼フロー");
      }
      break;
    default:
      handler = null;
  }

  if (!handler || (typeof handler.handle !== "function" && typeof handler.execute !== "function")) {
    logger.error("ハンドラーの形式が不正です", {
      customId: interaction.customId,
    });
    return;
  }

  const exec = handler.handle || handler.execute;
  return exec(interaction, client, parsed);
}

async function handleInteraction(interaction, client) {
  try {
    logger.debug("handlerルーティング", {
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
        return safeReply(interaction, { content: "未登録のコマンドです。" });
      }
      return await cmd.execute(interaction, client);
    }

    // Thread Policy Select Menu
    if (interaction.isStringSelectMenu() && (interaction.customId === "memo:threadpolicy:select" || interaction.customId === "memo|threadpolicy|sub=select")) {
      return require("./メモ管理/スレッドポリシー設定")(interaction);
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
          logger.error("handlerMap execute error", { customId: interaction.customId, error: err.message });
          if (!interaction.replied && !interaction.deferred) {
            return safeReply(interaction, { content: "処理中にエラーが発生しました。", flags: MessageFlags.Ephemeral });
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
    logger.error("💥 interaction処理で致命的な例外が発生しました", {
      customId: interaction.customId,
      error: err.stack,
    });
    return safeReply(interaction, { content: "❌ 処理中に予期せぬエラーが発生しました。", flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  handleInteraction,
  parseCustomId,
};
