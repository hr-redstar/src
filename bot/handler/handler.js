// src/bot/handler/handler.js
// interaction を種類ごとに振り分け → customId なら各パネルの index.js に委譲
const { MessageFlags } = require("discord.js");
const logger = require("../utils/ログ/ロガー");

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

function parseCustomId(customId) {
  const raw = String(customId || "");
  const parts = raw.split(":");

  // これからの命名（button:xxx:yyy / modal:xxx:yyy）にも対応
  const typed = ["button", "modal", "select"].includes(parts[0]);

  if (typed) {
    return {
      raw,
      type: parts[0],            // button / modal / select
      ns: parts[1] || "",        // 例: ps / admin / driver / user
      action: parts[2] || "",    // 例: send / open / ...
      rest: parts.slice(3),      // 残り
      parts,
    };
  }

  // 従来形式（ps:send:Panel_admin など）
  return {
    raw,
    type: "",                   // なし
    ns: parts[0] || "",         // ps / admin / driver / user
    action: parts[1] || "",
    rest: parts.slice(2),
    parts,
  };
}

async function safeReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) return await interaction.editReply(payload);
    return await interaction.reply(payload);
  } catch (_) { }
}

async function routeToPanelHandler(interaction, client) {
  const parsed = parseCustomId(interaction.customId);

  // ns（先頭識別子）でルーティング
  // - ps:...        → パネル設置パネル
  // - admin:...     → 管理者パネル
  // - driver:...    → 送迎パネル
  // - user:...      → 利用者パネル
  let handler;

  switch (parsed.ns) {
    case "admin":
      handler = require("./管理者パネル/メイン");
      break;
    case "driver":
      handler = require("./送迎パネル/メイン");
      break;
    case "user":
      handler = require("./利用者パネル/メイン");
      break;
    case "regdriver":
      handler = require("./登録処理/送迎者登録");
      break;
    case "reguser":
      handler = require("./登録処理/利用者登録");
      break;
    case "dispatch":
      handler = require("./配車システム/配車依頼フロー");
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

    // 管理者パネル・他（自動ルーティングへ移行中）
    // 従来の個別 if ブロックを整理し、可能な限り routeToPanelHandler に集約

    // Send Driver Registration Button/Modal (New Modular)
    if (interaction.isButton() && interaction.customId === "driver:btn:register") {
      return require("./送迎者/registerButton")(interaction);
    }
    if (interaction.isModalSubmit() && interaction.customId === "driver:modal:register") {
      return require("./送迎者/registerModal")(interaction);
    }

    // 送迎者登録（ボタン/モーダル）
    if (interaction.customId === "driver:register" || interaction.customId === "driver:register:modal" ||
      interaction.customId === "btn:regdriver:register" || interaction.customId === "modal:regdriver:register") {
      return require("./登録処理/送迎者登録").execute(interaction);
    }

    // 利用者登録（ボタン/モーダル）
    if (interaction.customId === 'user:register' || interaction.customId === 'user:register:modal' ||
      interaction.customId === 'btn:reguser:register' || interaction.customId === 'modal:reguser:register') {
      return require('./登録処理/利用者登録').execute(interaction);
    }

    // 出勤/退勤/現在地更新
    if (interaction.isButton()) {
      if (interaction.customId === 'driver:on') {
        return require('./送迎パネル/アクション/出勤')(interaction);
      }
      if (interaction.customId === 'driver:off') {
        return require('./送迎パネル/アクション/退勤')(interaction);
      }
      if (interaction.customId === 'driver:location') {
        return require('./送迎パネル/アクション/現在地更新')(interaction);
      }
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'driver:on:modal') {
        return require('./送迎パネル/アクション/出勤モーダル')(interaction);
      }
      if (interaction.customId === 'driver:location:modal') {
        return require('./送迎パネル/アクション/現在地更新モーダル')(interaction);
      }
    }

    // 送迎依頼
    if (interaction.isButton()) {
      if (interaction.customId === 'user:ride:request') {
        return require('./利用者パネル/アクション/送迎依頼')(interaction);
      }
      if (interaction.customId === 'user:ride:guest') {
        return require('./利用者パネル/アクション/ゲスト送迎依頼')(interaction);
      }
    }
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'user:ride:request:modal' || interaction.customId === 'user:ride:guest:modal') {
        return require('./利用者パネル/アクション/送迎依頼モーダル')(interaction);
      }
    }

    // 送迎開始/終了
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ride:start:')) {
        const id = interaction.customId.split(':')[2];
        return require('./送迎処理/送迎開始')(interaction, id);
      }
      if (interaction.customId.startsWith('ride:end:')) {
        const id = interaction.customId.split(':')[2];
        return require('./送迎処理/送迎終了')(interaction, id);
      }
    }

    // 評価システム
    if (interaction.customId?.startsWith('dispatch:rating:')) {
      const ratingHandler = require('./配車システム/評価システム');
      const parsed = parseCustomId(interaction.customId);
      if (interaction.isModalSubmit()) {
        return ratingHandler.handleModalSubmit(interaction, parsed);
      }
      return ratingHandler.execute(interaction, client, parsed);
    }

    // 相乗り系
    if (interaction.customId?.startsWith('carpool:')) {
      const parts = interaction.customId.split(':');
      const action = parts[1];

      if (interaction.isButton()) {
        if (action === 'join') return require('./相乗り/相乗り希望').execute(interaction);
        if (action === 'approve') return require('./相乗り/承認').execute(interaction);
        if (action === 'reject') return require('./相乗り/却下理由選択').execute(interaction);
        if (action === 'cancel') return require('./相乗り/相乗りキャンセル').execute(interaction);
      }
      if (interaction.isModalSubmit()) {
        if (action === 'join' && parts[2] === 'modal') return require('./相乗り/相乗り希望モーダル').execute(interaction);
        if (action === 'reject_modal') return require('./相乗り/却下モーダル').execute(interaction);
      }
      if (interaction.isStringSelectMenu()) {
        if (action === 'reject_reason') return require('./相乗り/却下理由処理').execute(interaction);
      }
    }

    // VCコントロールパネル (送迎開始・キャンセル・終了)
    if (interaction.isButton() && interaction.customId?.startsWith('ride:')) {
      const parts = interaction.customId.split(':');
      const action = parts[1];
      const rideId = parts[2];

      if (action === 'enroute') return require('./送迎処理/VCコントロール/向かっています')(interaction, rideId);
      if (action === 'start') return require('./送迎処理/VCコントロール/送迎開始')(interaction, rideId);
      if (action === 'cancel') return require('./送迎処理/VCコントロール/送迎キャンセル')(interaction, rideId);
      if (action === 'complete') return require('./送迎処理/VCコントロール/送迎終了')(interaction, rideId);
    }

    // Send End Extension
    if (interaction.isButton() && interaction.customId === "ride:extend") {
      return require("./送迎処理/保存期間延長")(interaction);
    }
    if (interaction.isButton() && interaction.customId === "ride:delete") {
      return require("./送迎処理/即時削除")(interaction);
    }

    // Thread Policy Select Menu
    if (interaction.isStringSelectMenu() && interaction.customId === "memo:threadpolicy:select") {
      return require("./メモ管理/スレッドポリシー設定")(interaction);
    }

    // パネル設置 (案内パネル)
    if (interaction.isModalSubmit() && interaction.customId === 'ps:modal:guideInitial') {
      return require('./パネル設置/アクション/案内パネル初期入力').execute(interaction);
    }
    if (interaction.isAnySelectMenu() && interaction.customId.startsWith('ps:select:guidePanelChannel')) {
      return require('./パネル設置/アクション/案内パネル送信先選択').execute(interaction);
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
