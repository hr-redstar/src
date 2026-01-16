// handler/パネル設置/パネル共通/_panelSetupCommon.js
const {
  PermissionsBitField,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');


/**
 * パネル設置パネル共通ユーティリティ
 * - 管理者チェック
 * - 安全な返信処理（interaction状態吸収）
 * - 送信可能チャンネル判定
 * - 共通Embed生成
 *
 * ※ 基本的に interaction.channel を前提にする
 */

const CUSTOM_ID = {
  // パネル送信系（パネル設置パネルから送られる）
  SEND_ADMIN_PANEL: 'ps:send:Panel_admin',
  SEND_DRIVER_PANEL: 'ps:send:Panel_driver',
  SEND_USER_PANEL: 'ps:send:Panel_user',

  SEND_DRIVER_REG_PANEL: 'ps:send:Panel_Regdriver',
  SEND_USER_REG_PANEL: 'ps:send:Panel_Reg',

  SEND_USER_CHECK_PANEL: 'ps:send:Panel_userCheck',
  SEND_RIDE_LIST_PANEL: 'ps:send:Panel_rideList',
  SEND_CARPOOL_PANEL: 'ps:send:Panel_carpool',
  SEND_GUIDE_PANEL: 'ps:send:Panel_guide',
  SEND_RATING_RANK_PANEL: 'ps:send:Panel_ratingRank',
  SEND_GLOBAL_LOG_PANEL: 'ps:send:Panel_globalLog',
  SEND_GLOBAL_LOG_PANEL: 'ps:send:Panel_globalLog',
  SEND_OPERATOR_LOG_PANEL: 'ps:send:Panel_operatorLog',

  // チャンネル選択（パネル設置時）
  SELECT_ADMIN_PANEL_CHANNEL: 'ps:select:adminPanelChannel',
  SELECT_DRIVER_PANEL_CHANNEL: 'ps:select:driverPanelChannel',
  SELECT_USER_PANEL_CHANNEL: 'ps:select:userPanelChannel',
  SELECT_DRIVER_REG_PANEL_CHANNEL: 'ps:select:driverRegPanelChannel',
  SELECT_USER_REG_PANEL_CHANNEL: 'ps:select:userRegPanelChannel',
  SELECT_USER_CHECK_PANEL_CHANNEL: 'ps:select:userCheckPanelChannel',
  SELECT_RIDE_LIST_PANEL_CHANNEL: 'ps:select:rideListPanelChannel',
  SELECT_CARPOOL_PANEL_CHANNEL: 'ps:select:carpoolPanelChannel',
  SELECT_GUIDE_PANEL_CHANNEL: 'ps:select:guidePanelChannel',
  SELECT_GLOBAL_LOG_CHANNEL: 'ps:select:globalLogChannel',
  SELECT_OPERATOR_LOG_CHANNEL: 'ps:select:operatorLogChannel',

  // 内部選択用・エイリアス（アクションファイルで使用されている名称）
  SEL_ADMIN_PANEL: 'ps:select:adminPanelChannel',
  SEL_DRIVER_PANEL: 'ps:select:driverPanelChannel',
  SEL_USER_PANEL: 'ps:select:userPanelChannel',
  SEL_DRIVER_REG_PANEL: 'ps:select:driverRegPanelChannel',
  SEL_USER_REG_PANEL: 'ps:select:userRegPanelChannel',
  SEL_USER_CHECK_PANEL: 'ps:select:userCheckPanelChannel',
  SEL_RIDE_LIST_PANEL: 'ps:select:rideListPanelChannel',
  SEL_CARPOOL_PANEL: 'ps:select:carpoolPanelChannel',
  SEL_GUIDE_PANEL: 'ps:select:guidePanelChannel',
};

// パネル内部で使用するID（ここのファイル外では直接使わない）
const INNER_ID = {
  // driver shift panel
  DRIVER_NOW_AVAILABLE: 'driver:shift:now',
  DRIVER_CLOCK_OUT: 'driver:shift:off',

  // driver reg
  DRIVER_REGISTER: 'driver:reg:open',

  // user reg
  USER_REGISTER: 'user:reg:open',

  // lists / moderation
  DRIVERLIST_EDIT: 'driver:list:edit',
  DRIVERLIST_DELETE: 'driver:list:delete',
  USERCHECK_REFRESH: 'user:check:refresh',
};

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionsBitField.Flags.Administrator
  );
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await safeEphemeral(
      interaction,
      '⚠️ この操作は管理者のみ実行できます。'
    );
    return false;
  }
  return true;
}

function ensureSendableChannel(interaction) {
  const ch = interaction.channel;
  if (!ch) return null;

  // Text / Announcement のみ送信可
  if (
    ch.type === ChannelType.GuildText ||
    ch.type === ChannelType.GuildAnnouncement
  ) {
    return ch;
  }
  return null;
}

// 安全な返信（ephemeral専用）
async function safeEphemeral(interaction, content) {
  try {
    const payload = { content, flags: MessageFlags.Ephemeral };

    if (interaction.replied || interaction.deferred) {
      return await interaction.followUp(payload).catch(() => interaction.editReply(payload));
    }

    return await interaction.reply(payload);
  } catch (err) {
    console.error('💥 safeEphemeral error:', err);
  }
}

async function sendPanelToCurrentChannel(interaction, messagePayload) {
  const ch = ensureSendableChannel(interaction);
  if (!ch) {
    await safeEphemeral(
      interaction,
      '⚠️ このチャンネルにはパネルを送信できません。\nテキストチャンネルで実行してください。'
    );
    return false;
  }
  await ch.send(messagePayload);
  return true;
}

function buildInfoEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description);
}

module.exports = {
  CUSTOM_ID,
  INNER_ID,
  requireAdmin,
  safeEphemeral,
  sendPanelToCurrentChannel,
  buildInfoEmbed,

  // discord.js 再エクスポート（各パネルで統一利用）
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
};
