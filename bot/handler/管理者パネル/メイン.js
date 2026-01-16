const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
} = require("discord.js");

const { sendOrUpdatePanel } = require("../共通/パネル送信");
const { loadConfig, saveConfig } = require("../../utils/設定/設定マネージャ");
const buildPanelEmbed = require("../../utils/embed/embedTemplate");
const buildPanelMessage = require("../../utils/embed/panelMessageTemplate");
const autoInteractionTemplate = require("../共通/autoInteractionTemplate");
const { ACK } = autoInteractionTemplate;

// ===== Custom IDs =====
const CID = {
  // Main Buttons
  BTN_DRIVER_ROLE: "admin:btn:driver_role",
  BTN_USER_ROLE: "admin:btn:user_role",
  BTN_PRIORITY_ROLE: "admin:btn:priority_role",
  BTN_PV_CATEGORY: "admin:btn:pv_category",
  BTN_MEMO_CATEGORY: "admin:btn:memo_category",
  BTN_GLOBAL_LOG: "admin:btn:global_log",
  BTN_STAFF_LOG: "admin:btn:staff_log",
  BTN_ADMIN_THREAD: "admin:btn:admin_thread",
  BTN_CARPOOL_CH: "admin:btn:carpool_ch",
  BTN_EDIT_DIRECTIONS: "admin:btn:edit_directions",

  // Secondary Interactions
  SEL_DRIVER_ROLE: "admin:sel:driver_role",
  SEL_USER_ROLE: "admin:sel:user_role",
  SEL_PRIORITY_ROLE: "admin:sel:priority_role",
  SEL_DRIVER_MENTION: "admin:sel:driver_mention",
  SEL_USER_MENTION: "admin:sel:user_mention",
  SEL_PRIORITY_MENTION: "admin:sel:priority_mention",

  SEL_PV_CATEGORY: "admin:sel:pv_category",
  SEL_MEMO_CATEGORY: "admin:sel:memo_category",

  SEL_GLOBAL_LOG: "admin:sel:global_log",
  SEL_STAFF_LOG: "admin:sel:staff_log",

  SEL_CARPOOL_CH: "admin:sel:carpool_ch",
  MODAL_EDIT_DIRECTIONS: "admin:modal:edit_directions",
};

// ===== Display helpers =====
function mentionRoles(ids) {
  if (!ids || ids.length === 0) return "未設定";
  return ids.map((id) => `<@&${id}>`).join(" ");
}
function mentionOneRole(id) {
  return id ? `<@&${id}>` : "未設定";
}
function mentionCategory(id) {
  return id ? `📁 <#${id}>` : "未設定";
}
function mentionChannel(id) {
  return id ? `<#${id}>` : "未設定";
}

function buildRoleSelect(cid, placeholder, defaults = [], max = 25) {
  const menu = new RoleSelectMenuBuilder()
    .setCustomId(cid)
    .setPlaceholder(placeholder)
    .setMinValues(0)
    .setMaxValues(max);

  const filtered = (defaults || []).filter(Boolean);
  if (filtered.length > 0) {
    menu.addDefaultRoles(filtered);
  }
  return new ActionRowBuilder().addComponents(menu);
}
function buildChannelSelect(cid, placeholder, types = [ChannelType.GuildText], defaults = []) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(cid)
    .setPlaceholder(placeholder)
    .setChannelTypes(types)
    .setMinValues(0)
    .setMaxValues(1);

  const filtered = (defaults || []).filter(Boolean);
  if (filtered.length > 0) {
    menu.addDefaultChannels(filtered);
  }
  return new ActionRowBuilder().addComponents(menu);
}

function buildAdminPanelEmbed(guild, cfg, client) {
  const roles = cfg.roles || {};
  const logs = cfg.logs || {};
  const cats = cfg.categories || {};

  return buildPanelEmbed({
    title: "管理者パネル",
    description: `
---------------------------------
管理者パネル

**送迎者ロール**
${mentionRoles(roles.drivers)}
**メンションロール**
${mentionOneRole(roles.driverMention)}

**お客様ロール**
${mentionRoles(roles.users)}
**メンションロール**
${mentionOneRole(roles.userMention)}

**優先配車ロール**
${mentionRoles(roles.priorityDrivers)}
**メンションロール**
${mentionOneRole(roles.priorityMention)}

**プライベートvcカテゴリー**
${mentionCategory(cats.privateVc)}

**ユーザーメモカテゴリー**
${mentionCategory(cats.userMemo)}

**グローバルログ**
${mentionChannel(logs.globalChannel)}

**運営者ログチャンネル**
${mentionChannel(logs.operatorChannel)}

**管理者用ログスレッド**
${mentionChannel(logs.adminLogThread)}

**相乗りチャンネル**
${mentionChannel(cfg.rideShareChannel)}
    `,
    client,
    color: 0x3498db
  });
}

function buildAdminPanelComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CID.BTN_DRIVER_ROLE).setLabel("送迎者ロール登録").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CID.BTN_USER_ROLE).setLabel("利用者ロール登録").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(CID.BTN_PRIORITY_ROLE).setLabel("優先配車ロール設定").setStyle(ButtonStyle.Primary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CID.BTN_PV_CATEGORY).setLabel("プライベートvcカテゴリー").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(CID.BTN_MEMO_CATEGORY).setLabel("ユーザーメモカテゴリー").setStyle(ButtonStyle.Secondary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CID.BTN_GLOBAL_LOG).setLabel("グローバルログ登録").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CID.BTN_STAFF_LOG).setLabel("運用者ログ登録").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CID.BTN_ADMIN_THREAD).setLabel("管理者用スレッド作成").setStyle(ButtonStyle.Success)
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CID.BTN_CARPOOL_CH).setLabel("相乗りチャンネル設定").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(CID.BTN_EDIT_DIRECTIONS).setLabel("方面リスト編集").setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3, row4];
}

function buildAdminPanelMessage(guild, cfg, client) {
  const embed = buildAdminPanelEmbed(guild, cfg, client);
  const components = buildAdminPanelComponents();
  return buildPanelMessage({ embed, components });
}

async function updateAdminPanelMessage(guild, cfg, client) {
  const panel = cfg.panels?.admin;
  if (!panel || !panel.channelId) return false;

  const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!ch) return false;

  const newMessageId = await sendOrUpdatePanel({
    channel: ch,
    messageId: panel.messageId,
    buildMessage: async () => buildAdminPanelMessage(guild, cfg, client),
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    if (!cfg.panels) cfg.panels = {};
    if (!cfg.panels.admin) cfg.panels.admin = {};
    cfg.panels.admin.messageId = newMessageId;
    await saveConfig(guild.id, cfg);
  }
  return true;
}

async function execute(interaction, client) {
  const { customId } = interaction;

  // --- 外部委譲・特殊ボタン ---
  if (interaction.isButton()) {
    if (customId === 'admin:btn:rating_check_start') return require('./アクション/評価確認').execute(interaction);
    if (customId.startsWith('admin:rating_check:comments')) {
      const parts = customId.split(':');
      return require('./アクション/評価確認').handleCommentCheck(interaction, parts[3], parts[4]);
    }
    if (customId === 'admin:btn:register_rank_tiers_start') return require('./アクション/ランク階級登録').execute(interaction);
    if (customId === 'admin:btn:set_rank_start') return require('./アクション/ランク設定').execute(interaction);
  }

  // --- セレクトメニュー委譲 ---
  if (interaction.isAnySelectMenu()) {
    if (customId === 'admin:rating_check:user_select') return require('./アクション/評価確認').handleUserSelect(interaction);
    if (customId === 'admin:rank_set:user_select') return require('./アクション/ランク設定').handleUserSelect(interaction);
    if (customId.startsWith('admin:rank_set:tier_select')) {
      const parts = customId.split(':');
      return require('./アクション/ランク設定').handleRankSelect(interaction, parts[3], parts[4]);
    }
  }

  // --- メインダッシュボードロジック (Buttons & SelectMenus) ---
  if (interaction.isButton() || interaction.isAnySelectMenu()) {
    // ボタンの振り分け
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.REPLY,
      async run(interaction) {
        const { values } = interaction;
        const cfg = await loadConfig(interaction.guildId);

        let content = "項目を選択してください。";
        let row;

        switch (customId) {
          // Row 1
          case CID.BTN_DRIVER_ROLE:
            content = "🚗 **送迎者ロール** を選択してください。（複数選択可）";
            row = buildRoleSelect(CID.SEL_DRIVER_ROLE, "ロールを選択", cfg.roles.drivers || []);
            break;
          case CID.BTN_USER_ROLE:
            content = "👤 **利用者ロール** を選択してください。（複数選択可）";
            row = buildRoleSelect(CID.SEL_USER_ROLE, "ロールを選択", cfg.roles.users || []);
            break;
          case CID.BTN_PRIORITY_ROLE:
            content = "⭐ **優先配車ロール** を選択してください。（複数選択可）";
            row = buildRoleSelect(CID.SEL_PRIORITY_ROLE, "ロールを選択", cfg.roles.priorityDrivers || []);
            break;

          // Row 2
          case CID.BTN_PV_CATEGORY:
            content = "🔒 **プライベートvcカテゴリー** を選択してください。";
            row = buildChannelSelect(CID.SEL_PV_CATEGORY, "カテゴリーを選択", [ChannelType.GuildCategory], [cfg.categories.privateVc]);
            break;
          case CID.BTN_MEMO_CATEGORY:
            content = "📝 **ユーザーメモカテゴリー** を選択してください。";
            row = buildChannelSelect(CID.SEL_MEMO_CATEGORY, "カテゴリーを選択", [ChannelType.GuildCategory], [cfg.categories.userMemo]);
            break;

          // Row 3
          case CID.BTN_GLOBAL_LOG:
            content = "🌐 **グローバルログ** の送信先チャンネルを選択してください。";
            row = buildChannelSelect(CID.SEL_GLOBAL_LOG, "チャンネルを選択", [ChannelType.GuildText], [cfg.logs?.globalChannel]);
            break;
          case CID.BTN_STAFF_LOG:
            content = "🛠️ **運営者ログ** の送信先チャンネルを選択してください。";
            row = buildChannelSelect(CID.SEL_STAFF_LOG, "チャンネルを選択", [ChannelType.GuildText], [cfg.logs.operatorChannel]);
            break;
          case CID.BTN_ADMIN_THREAD:
            if (!cfg.logs.operatorChannel) return interaction.editReply({ content: "⚠️ 先に **運営者ログチャンネル** を登録してください。" });
            try {
              const opCh = await interaction.guild.channels.fetch(cfg.logs.operatorChannel);
              const index = cfg.logs.adminLogThreadIndex || 1;
              const threadName = `管理者ログ ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${index}`;
              const thread = await opCh.threads.create({ name: threadName, autoArchiveDuration: 60 });
              cfg.logs.adminLogThread = thread.id;
              cfg.logs.adminLogThreadIndex = index + 1;
              await saveConfig(interaction.guildId, cfg);
              await thread.send({ content: `✅ **管理者ログスレッド** が作成されました。\n作成者: <@${interaction.user.id}>` });
              await updateAdminPanelMessage(interaction.guild, cfg, client);
              return interaction.editReply({ content: `✅ スレッド <#${thread.id}> を作成しました。` });
            } catch (err) {
              return interaction.editReply({ content: `❌ スレッド作成失敗: ${err.message}` });
            }

          // Row 4
          case CID.BTN_CARPOOL_CH:
            content = "🚕 **相乗りチャンネル** を選択してください。";
            row = buildChannelSelect(CID.SEL_CARPOOL_CH, "チャンネルを選択", [ChannelType.GuildText], [cfg.rideShareChannel]);
            break;

          case CID.BTN_EDIT_DIRECTIONS: {
            const { ModalBuilder, TextInputBuilder, TextInputStyle } = require("discord.js");
            const modal = new ModalBuilder().setCustomId(CID.MODAL_EDIT_DIRECTIONS).setTitle("方面リスト編集");
            modal.addComponents(new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId("directions").setLabel("方面（カンマ区切り）").setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("立川方面,八王子市内,相模原方面,その他").setValue(cfg.directions?.join(",") || "").setRequired(true)
            ));
            return await interaction.showModal(modal);
          }

          // --- 設定保存 (Secondary Select Menus) ---
          case CID.SEL_DRIVER_ROLE:
            cfg.roles.drivers = values;
            await saveConfig(interaction.guildId, cfg);
            return interaction.editReply({
              content: "✅ **送迎者ロール** を保存しました。続けて **メンション用ロール** を選択してください。",
              components: [buildRoleSelect(CID.SEL_DRIVER_MENTION, "メンションロールを選択", [cfg.roles.driverMention], 1)]
            });
          case CID.SEL_DRIVER_MENTION:
            cfg.roles.driverMention = values[0];
            await finalize(interaction, cfg, "送迎ロール・メンション更新", { "roles.drivers": "送迎者ロール", "roles.driverMention": "送迎メンション" });
            return;

          case CID.SEL_USER_ROLE:
            cfg.roles.users = values;
            await saveConfig(interaction.guildId, cfg);
            return interaction.editReply({
              content: "✅ **利用者ロール** を保存しました。続けて **メンション用ロール** を選択してください。",
              components: [buildRoleSelect(CID.SEL_USER_MENTION, "メンションロールを選択", [cfg.roles.userMention], 1)]
            });
          case CID.SEL_USER_MENTION:
            cfg.roles.userMention = values[0];
            await finalize(interaction, cfg, "利用者ロール・メンション更新", { "roles.users": "利用者ロール", "roles.userMention": "利用メンション" });
            return;

          case CID.SEL_PRIORITY_ROLE:
            cfg.roles.priorityDrivers = values;
            await saveConfig(interaction.guildId, cfg);
            return interaction.editReply({
              content: "✅ **優先配車ロール** を保存しました。続けて **メンション用ロール** を選択してください。",
              components: [buildRoleSelect(CID.SEL_PRIORITY_MENTION, "メンションロールを選択", [cfg.roles.priorityMention], 1)]
            });
          case CID.SEL_PRIORITY_MENTION:
            cfg.roles.priorityMention = values[0];
            await finalize(interaction, cfg, "優先配車ロール・メンション更新", { "roles.priorityDrivers": "優先配車ロール", "roles.priorityMention": "優先メンション" });
            return;

          case CID.SEL_PV_CATEGORY:
            cfg.categories.privateVc = values[0];
            await finalize(interaction, cfg, "カテゴリー更新", { "categories.privateVc": "プライベートVC" });
            return;
          case CID.SEL_MEMO_CATEGORY:
            cfg.categories.userMemo = values[0];
            await finalize(interaction, cfg, "カテゴリー更新", { "categories.userMemo": "ユーザーメモ" });
            return;
          case CID.SEL_GLOBAL_LOG:
            cfg.logs.globalChannel = values[0];
            await finalize(interaction, cfg, "ログ設定更新", { "logs.globalChannel": "グローバルログ" });
            return;
          case CID.SEL_STAFF_LOG:
            cfg.logs.operatorChannel = values[0];
            await finalize(interaction, cfg, "ログ設定更新", { "logs.operatorChannel": "運営者ログ" });
            return;
          case CID.SEL_CARPOOL_CH:
            cfg.rideShareChannel = values[0];
            if (!cfg.panels) cfg.panels = {};
            if (!cfg.panels.carpoolPanel) cfg.panels.carpoolPanel = {};
            cfg.panels.carpoolPanel.channelId = values[0];
            await finalize(interaction, cfg, "相乗りチャンネル更新", { "rideShareChannel": "相乗り通知先" });
            return;
        }

        if (row) return interaction.editReply({ content, components: [row] });
      }
    });
  }

  // --- モーダル送信時 ---
  if (interaction.isModalSubmit()) {
    if (customId === 'admin:modal:register_rank_tiers') {
      return require('./アクション/口コミランク管理/ランク階級登録').handleModal(interaction);
    }
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      async run(interaction) {
        const cfg = await loadConfig(interaction.guildId);
        if (customId === CID.MODAL_EDIT_DIRECTIONS) {
          const raw = interaction.fields.getTextInputValue("directions");
          cfg.directions = raw.split(",").map(d => d.trim()).filter(Boolean);
          await saveConfig(interaction.guildId, cfg);
          await updateAdminPanelMessage(interaction.guild, cfg, client);
          return interaction.editReply({ content: "✅ 方面リストを更新しました。" });
        }
      }
    });
  }

  // 設定保存とログ記録の共通処理
  async function finalize(interaction, cfg, title, mapping) {
    const { logConfigChange } = require("../../utils/ログ/差分ログ");
    await saveConfig(interaction.guildId, cfg);
    await logConfigChange({ guild: interaction.guild, user: interaction.user, title, newConfig: cfg, mapping });
    await updateAdminPanelMessage(interaction.guild, cfg, client);
    return interaction.editReply({ content: "✅ 設定を更新しました。", components: [] });
  }
}

module.exports = {
  CID,
  buildAdminPanelMessage,
  execute,
  updateAdminPanelMessage,
};
