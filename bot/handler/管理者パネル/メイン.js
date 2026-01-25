﻿const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  RoleSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const autoInteractionTemplate = require('../共通/autoInteractionTemplate');
const { ACK } = autoInteractionTemplate;

// ===== Custom IDs =====
const CID = {
  // Main Buttons (ns: adm)
  BTN_DRIVER_ROLE: 'adm|role|type=driver',
  BTN_USER_ROLE: 'adm|role|type=user',
  BTN_PRIORITY_ROLE: 'adm|role|type=priority',
  BTN_PV_CATEGORY: 'adm|cat|type=pv',
  BTN_MEMO_CATEGORY: 'adm|cat|type=memo',
  BTN_GLOBAL_LOG: 'adm|log|type=global',
  BTN_GLOBAL_THREAD: 'adm|log|type=global_thread',
  BTN_STAFF_LOG: 'adm|log|type=operator',
  BTN_ADMIN_THREAD: 'adm|log|type=thread',
  BTN_CARPOOL_CH: 'adm|carpool|type=ch',
  BTN_EDIT_DIRECTIONS: 'adm|directions|sub=button',
  BTN_SEND_OP_PANEL: 'adm|operator|sub=send',

  // Secondary Interactions
  SEL_DRIVER_ROLE: 'adm|role|type=driver_sel',
  SEL_USER_ROLE: 'adm|role|type=user_sel',
  SEL_PRIORITY_ROLE: 'adm|role|type=priority_sel',
  SEL_DRIVER_MENTION: 'adm|role|type=driver_mtn',
  SEL_USER_MENTION: 'adm|role|type=user_mtn',
  SEL_PRIORITY_MENTION: 'adm|role|type=priority_mtn',

  SEL_PV_CATEGORY: 'adm|cat|type=pv_sel',
  SEL_MEMO_CATEGORY: 'adm|cat|type=memo_sel',

  SEL_GLOBAL_LOG: 'adm|log|type=global_sel',
  SEL_STAFF_LOG: 'adm|log|type=operator_sel',

  SEL_CARPOOL_CH: 'adm|carpool|type=ch_sel',
  MODAL_EDIT_DIRECTIONS: 'adm|directions|sub=modal',

  // Sub Panels
  BTN_RANK_MANAGE: 'adm|rank_manage|sub=start',

  // Operator Role (v1.3.6)
  BTN_OPERATOR_ROLE: 'adm|role|type=operator',
  SEL_OPERATOR_ROLE: 'adm|role|type=operator_sel',
};

// ===== Display helpers =====
function mentionRoles(ids) {
  if (!ids || ids.length === 0) return '未設定';
  return ids.map((id) => `<@&${id}>`).join(' ');
}
function mentionOneRole(id) {
  return id ? `<@&${id}>` : '未設定';
}
function mentionCategory(id) {
  return id ? `📁 <#${id}>` : '未設定';
}
function mentionChannel(id) {
  return id ? `<#${id}>` : '未設定';
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
    title: '🛡️ 管理者設定システム',
    description: 'システム全般の権限、保管場所、およびログの出勤先を管理します。',
    fields: [
      {
        name: '👥 ロール管理', value: [
          `**運営者**: ${mentionRoles(roles.operators)}`,
          `**送迎者**: ${mentionRoles(roles.drivers)}`,
          `**利用者**: ${mentionRoles(roles.users)}`,
          `**優先配車**: ${mentionRoles(roles.priorityDrivers)}`,
        ].join('\n'), inline: false
      },
      {
        name: '📂 カテゴリー保管場所', value: [
          `**プライベートVC**: ${mentionCategory(cats.privateVc)}`,
          `**個人メモ**: ${mentionCategory(cats.userMemo)}`,
        ].join('\n'), inline: true
      },
      {
        name: '📝 ログ・通知設定', value: [
          `**運営者ログ**: ${mentionChannel(logs.operatorChannel)}`,
          `**グローバルログ**: ${mentionChannel(logs.globalChannel)}`,
          `**相乗り通知**: ${mentionChannel(cfg.rideShareChannel)}`,
          `**管理者ログスレ**: ${mentionChannel(logs.adminLogThread)}`,
        ].join('\n'), inline: true
      },
    ],
    client,
    color: 0x3498db,
  });
}

function buildAdminPanelComponents() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_OPERATOR_ROLE)
      .setLabel('運営者ロール登録')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CID.BTN_DRIVER_ROLE)
      .setLabel('送迎者ロール登録')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CID.BTN_USER_ROLE)
      .setLabel('利用者ロール登録')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CID.BTN_PRIORITY_ROLE)
      .setLabel('優先配車ロール設定')
      .setStyle(ButtonStyle.Success)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_PV_CATEGORY)
      .setLabel('プライベートvcカテゴリー')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CID.BTN_MEMO_CATEGORY)
      .setLabel('ユーザーメモカテゴリー')
      .setStyle(ButtonStyle.Primary)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_GLOBAL_LOG)
      .setLabel('グローバルログ登録')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CID.BTN_STAFF_LOG)
      .setLabel('運用者ログ登録')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CID.BTN_ADMIN_THREAD)
      .setLabel('管理者用スレッド作成')
      .setStyle(ButtonStyle.Secondary)
  );
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CID.BTN_CARPOOL_CH)
      .setLabel('相乗りチャンネル設定')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CID.BTN_RANK_MANAGE)
      .setLabel('口コミランク管理')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(CID.BTN_SEND_OP_PANEL)
      .setLabel('運営者パネル')
      .setStyle(ButtonStyle.Primary)
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
    // saveConfigはfinalizeで行うため、ここでは呼び出さない
  }
  return true;
}

async function execute(interaction, client, parsed) {
  const { customId, MessageFlags } = interaction;

  // --- 外部委譲・特殊ボタン・サブパネル ---
  if (interaction.isButton()) {
    // 口コミランク管理パネルの表示
    if (customId === 'adm|rank_manage|sub=start') {
      return autoInteractionTemplate(interaction, {
        adminOnly: true,
        ack: ACK.REPLY,
        async run(interaction) {
          const { buildRatingRankPanelMessage } = require('./口コミランクパネル構築');
          const panel = buildRatingRankPanelMessage(interaction.guild);
          await interaction.editReply(panel);
        }
      });
    }

    // 口コミ確認フロー
    if (customId === 'adm|rating_check|sub=start')
      return require('../口コミランクパネル/アクション/口コミ確認').startFlow(interaction, client, parsed);

    // ランク階級登録
    if (customId === 'adm|rank_tiers|sub=start')
      return require('../口コミランクパネル/アクション/ランク階級登録').startFlow(interaction, client, parsed);

    // ランク設定
    if (customId === 'adm|rank_set|sub=start')
      return require('../口コミランクパネル/アクション/ランク設定').startFlow(interaction, client, parsed);

    // 履歴・統計
    if (parsed.action === 'history')
      return require('./アクション/履歴表示').execute(interaction, client, parsed);

    if (customId === 'adm|stats|sub=start')
      return require('../口コミランクパネル/アクション/統計ダッシュボード').showDashboard(interaction, client, parsed);

    if (parsed.action === 'rating_check' && parsed.params?.sub === 'comments')
      return require('../口コミランクパネル/アクション/口コミ確認').showComments(interaction, client, parsed);

    // 強制終了
    if (parsed.action === 'ride' && parsed.params?.sub === 'force_end_menu') {
      return require('../送迎処理/送迎強制終了').handleMenu(interaction, client);
    }

    // パネル設置 (v1.6.2)
    if (parsed.action === 'panel_setup') {
      return require('../パネル設置/アクション/パネル設置フロー').execute(interaction, client, parsed);
    }

    // 方面リスト登録 (Modal) - 方面リストパネルができたため不要（維持）

    // 運営者パネルの送信
    if (customId === CID.BTN_SEND_OP_PANEL) {
      const sendOperatorPanel = require('../運営者パネル/メイン');
      return sendOperatorPanel(interaction);
    }
  }

  // --- セレクトメニュー委譲 ---
  if (interaction.isAnySelectMenu()) {
    if (parsed.action === 'panel_setup') {
      return require('../パネル設置/アクション/パネル設置フロー').execute(interaction, client, parsed);
    }
    if (parsed.action === 'ride' && parsed.params?.sub === 'force_end_execute') {
      return require('../送迎処理/送迎強制終了').handleExecute(interaction, client);
    }
    if (parsed.action === 'rating_check' && parsed.params?.sub === 'user_sel')
      return require('../口コミランクパネル/アクション/口コミ確認').showStats(interaction, client, parsed);
    if (parsed.action === 'rank_set' && parsed.params?.sub === 'user_sel')
      return require('../口コミランクパネル/アクション/ランク設定').showTierSelect(interaction, client, parsed);
    if (parsed.action === 'rank_set' && parsed.params?.sub === 'tier_sel')
      return require('../口コミランクパネル/アクション/ランク設定').handleTierPick(interaction, client, parsed);
  }

  // --- モーダル送信委譲 ---
  if (interaction.isModalSubmit()) {
    if (parsed.action === 'rank_tiers' && parsed.params?.sub === 'modal') {
      return require('../口コミランクパネル/アクション/ランク階級登録').handleModal(interaction, parsed);
    }
  }

  // --- メインダッシュボードロジック ---
  if (interaction.isButton() || interaction.isAnySelectMenu()) {
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      ack: ACK.AUTO,
      async run(interaction) {
        const { values } = interaction;
        const cfg = await loadConfig(interaction.guildId);

        // 自己修復: ボタン操作時（＝パネル本体での操作時）にIDを同期する
        if ((interaction.isButton() || interaction.isAnySelectMenu()) && interaction.message) {
          if (!cfg.panels) cfg.panels = {};
          if (!cfg.panels.admin) cfg.panels.admin = {};

          if (cfg.panels.admin.messageId !== interaction.message.id) {
            cfg.panels.admin.channelId = interaction.channelId;
            cfg.panels.admin.messageId = interaction.message.id;
            await saveConfig(interaction.guildId, cfg);
          }
        }

        let content = '項目を選択してください。';
        let row;

        switch (customId) {
          // Row 1
          case CID.BTN_DRIVER_ROLE:
            content = '🚗 **送迎者ロール** を選択してください。（複数選択可）';
            row = buildRoleSelect(CID.SEL_DRIVER_ROLE, 'ロールを選択', cfg.roles.drivers || []);
            break;
          case CID.BTN_USER_ROLE:
            content = '👤 **利用者ロール** を選択してください。（複数選択可）';
            row = buildRoleSelect(CID.SEL_USER_ROLE, 'ロールを選択', cfg.roles.users || []);
            break;
          case CID.BTN_PRIORITY_ROLE:
            content = '⭐ **優先配車ロール** を選択してください。（複数選択可）';
            row = buildRoleSelect(CID.SEL_PRIORITY_ROLE, 'ロールを選択', cfg.roles.priorityDrivers || []);
            break;

          // Row 2
          case CID.BTN_PV_CATEGORY:
            content = '🔒 **プライベートvcカテゴリー** を選択してください。';
            row = buildChannelSelect(CID.SEL_PV_CATEGORY, 'カテゴリーを選択', [ChannelType.GuildCategory], [cfg.categories.privateVc]);
            break;
          case CID.BTN_MEMO_CATEGORY:
            content = '📝 **ユーザーメモカテゴリー** を選択してください。';
            row = buildChannelSelect(CID.SEL_MEMO_CATEGORY, 'カテゴリーを選択', [ChannelType.GuildCategory], [cfg.categories.userMemo]);
            break;

          case CID.BTN_GLOBAL_LOG:
            content = '🌐 **グローバルログ** の送信先チャンネルを選択してください。';
            row = buildChannelSelect(CID.SEL_GLOBAL_LOG, 'チャンネルを選択', [ChannelType.GuildText], [cfg.logs.globalChannel]);
            break;

          case CID.BTN_STAFF_LOG:
            content = '🛠️ **運営者ログ** の送信先チャンネルを選択してください。';
            row = buildChannelSelect(CID.SEL_STAFF_LOG, 'チャンネルを選択', [ChannelType.GuildText], [cfg.logs.operatorChannel]);
            break;

          case CID.BTN_ADMIN_THREAD:
            try {
              // 管理者パネルのチャンネルを親チャンネルとして使用
              const adminPanelChId = cfg.panels?.admin?.channelId;
              if (!adminPanelChId) return interaction.editReply({ content: '❌ 管理者パネルのチャンネルが見つかりません。' });
              const adminPanelCh = await interaction.guild.channels.fetch(adminPanelChId).catch(() => null);
              if (!adminPanelCh) return interaction.editReply({ content: '❌ 管理者パネルのチャンネルが見つかりません。' });

              const index = cfg.logs.adminLogThreadIndex || 1;
              const threadName = `管理者ログ ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${index}`;
              const thread = await adminPanelCh.threads.create({
                name: threadName,
                autoArchiveDuration: 60,
              });
              cfg.logs.adminLogThread = thread.id;
              cfg.logs.adminLogThreadIndex = index + 1;
              await saveConfig(interaction.guildId, cfg);
              await thread.send({
                content: `✅ **管理者ログスレッド** が作成されました。\n作成者: <@${interaction.user.id}>`,
              });
              await updateAdminPanelMessage(interaction.guild, cfg, client);
              return interaction.editReply({ content: `✅ スレッド <#${thread.id}> を作成しました。` });
            } catch (err) {
              return interaction.editReply({ content: `❌ スレッド作成失敗: ${err.message}` });
            }

          case CID.BTN_RANK_MANAGE: {
            const { buildRatingRankPanelMessage } = require('./口コミランクパネル構築');
            const panel = buildRatingRankPanelMessage(interaction.guild);
            return interaction.editReply(panel);
          }
          case CID.BTN_OPERATOR_ROLE:
            content = '🛡 **運営者ロール** を選択してください。（複数選択可）';
            row = buildRoleSelect(CID.SEL_OPERATOR_ROLE, '運営者ロールを選択', cfg.roles?.operators || [], 25);
            break;

          // Row 4
          case CID.BTN_CARPOOL_CH:
            content = '🚕 **相乗りチャンネル** を選択してください。';
            row = buildChannelSelect(CID.SEL_CARPOOL_CH, 'チャンネルを選択', [ChannelType.GuildText], [cfg.rideShareChannel]);
            break;

          // --- 設定保存 (Secondary Select Menus) ---
          case CID.SEL_DRIVER_ROLE:
            cfg.roles.drivers = values;
            await finalize(interaction, cfg, '送迎ロール更新', {
              'roles.drivers': '送迎者ロール',
            }, client);
            return;

          case CID.SEL_USER_ROLE:
            cfg.roles.users = values;
            await finalize(interaction, cfg, '利用者ロール更新', {
              'roles.users': '利用者ロール',
            }, client);
            return;

          case CID.SEL_PRIORITY_ROLE:
            cfg.roles.priorityDrivers = values;
            await finalize(interaction, cfg, '優先配車ロール更新', {
              'roles.priorityDrivers': '優先配車ロール',
            }, client);
            return;

          case CID.SEL_PV_CATEGORY:
            cfg.categories.privateVc = values[0];
            await finalize(interaction, cfg, 'カテゴリー更新', { 'categories.privateVc': 'プライベートVC' }, client);
            return;
          case CID.SEL_MEMO_CATEGORY:
            cfg.categories.userMemo = values[0];
            await finalize(interaction, cfg, 'カテゴリー更新', { 'categories.userMemo': 'ユーザーメモ' }, client);
            return;
          case CID.SEL_STAFF_LOG:
            cfg.logs.operatorChannel = values[0];
            await finalize(interaction, cfg, 'ログ設定更新', { 'logs.operatorChannel': '運営者ログ' }, client);
            return;
          case CID.SEL_GLOBAL_LOG:
            cfg.logs.globalChannel = values[0];
            await finalize(interaction, cfg, 'ログ設定更新', { 'logs.globalChannel': 'グローバルログ' }, client);
            return;
          case CID.SEL_CARPOOL_CH:
            cfg.rideShareChannel = values[0];
            if (!cfg.panels) cfg.panels = {};
            if (!cfg.panels.carpoolPanel) cfg.panels.carpoolPanel = {};
            cfg.panels.carpoolPanel.channelId = values[0];
            await finalize(interaction, cfg, '相乗りチャンネル更新', { rideShareChannel: '相乗り通知先' }, client);
            return;

          case CID.SEL_OPERATOR_ROLE: {
            cfg.roles ??= {};
            cfg.roles.operators = values;
            await finalize(interaction, cfg, '運営者ロール更新', {
              'roles.operators': '運営者ロール',
            }, client);
            return;
          }
        }

        if (row) return interaction.editReply({ content, components: [row] });
      },
    });
  }

  // --- モーダル送信時 ---
  if (interaction.isModalSubmit()) {
    if (parsed.action === 'history') {
      return require('./アクション/履歴表示').execute(interaction, client, parsed);
    }
    return autoInteractionTemplate(interaction, {
      adminOnly: true,
      async run(interaction) {
        // config loading dummy for compatibility
        const cfg = await loadConfig(interaction.guildId);
      },
    });
  }
}

/**
 * 設定保存とログ記録の共通処理
 */
async function finalize(interaction, cfg, title, mapping, client) {
  const { logConfigChange } = require('../../utils/ログ/差分ログ');

  // 1. 管理者パネルを更新（メッセージIDが更新される可能性がある）
  await updateAdminPanelMessage(interaction.guild, cfg, client);

  // 2. 設定を保存（更新されたメッセージIDを含む）
  await saveConfig(interaction.guildId, cfg);

  // 3. ログ記録
  await logConfigChange({
    guild: interaction.guild,
    user: interaction.user,
    title,
    newConfig: cfg,
    mapping,
  });

  return interaction.editReply({ content: '✅ 設定を更新しました。', components: [] });
}

module.exports = {
  CID,
  buildAdminPanelMessage,
  execute,
  updateAdminPanelMessage,
};
