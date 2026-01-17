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
  SEND_ADMIN_PANEL: 'ps|send|panel=admin',
  SEND_DRIVER_PANEL: 'ps|send|panel=driver',
  SEND_USER_PANEL: 'ps|send|panel=user',

  SEND_DRIVER_REG_PANEL: 'ps|send|panel=driverRegister',
  SEND_USER_REG_PANEL: 'ps|send|panel=userRegister',

  SEND_USER_CHECK_PANEL: 'ps|send|panel=userCheck',
  SEND_RIDE_LIST_PANEL: 'ps|send|panel=rideList',
  SEND_CARPOOL_PANEL: 'ps|send|panel=carpool',
  SEND_GUIDE_PANEL: 'ps|send|panel=guide',
  SEND_RATING_RANK_PANEL: 'ps|send|panel=ratingRank',
  SEND_GLOBAL_LOG_PANEL: 'ps|send|panel=globalLog',
  SEND_OPERATOR_LOG_PANEL: 'ps|send|panel=operatorLog',

  // チャンネル選択（パネル設置時）
  SELECT_ADMIN_PANEL_CHANNEL: 'ps|select|panel=admin',
  SELECT_DRIVER_PANEL_CHANNEL: 'ps|select|panel=driver',
  SELECT_USER_PANEL_CHANNEL: 'ps|select|panel=user',
  SELECT_DRIVER_REG_PANEL_CHANNEL: 'ps|select|panel=driverRegister',
  SELECT_USER_REG_PANEL_CHANNEL: 'ps|select|panel=userRegister',
  SELECT_USER_CHECK_PANEL_CHANNEL: 'ps|select|panel=userCheck',
  SELECT_RIDE_LIST_PANEL_CHANNEL: 'ps|select|panel=rideList',
  SELECT_CARPOOL_PANEL_CHANNEL: 'ps|select|panel=carpool',
  SELECT_GUIDE_PANEL_CHANNEL: 'ps|select|panel=guide',
  SELECT_RATING_RANK_PANEL_CHANNEL: 'ps|select|panel=ratingRank',
  SELECT_GLOBAL_LOG_CHANNEL: 'ps|select|panel=globalLog',
  SELECT_OPERATOR_LOG_CHANNEL: 'ps|select|panel=operatorLog',

  // 内部選択用・エイリアス（アクションファイルで使用されている名称）
  SEL_ADMIN_PANEL: 'ps|select|panel=admin',
  SEL_DRIVER_PANEL: 'ps|select|panel=driver',
  SEL_USER_PANEL: 'ps|select|panel=user',
  SEL_DRIVER_REG_PANEL: 'ps|select|panel=driverRegister',
  SEL_USER_REG_PANEL: 'ps|select|panel=userRegister',
  SEL_USER_CHECK_PANEL: 'ps|select|panel=userCheck',
  SEL_RIDE_LIST_PANEL: 'ps|select|panel=rideList',
  SEL_CARPOOL_PANEL: 'ps|select|panel=carpool',
  SEL_GUIDE_PANEL: 'ps|select|panel=guide',
  SEL_RATING_RANK_PANEL: 'ps|select|panel=ratingRank',
};

const PANEL_SETUP_IDS = {
  SETUP_START: 'ps|setup|sub=start',
  SETUP_TYPE_MENU: 'ps|setup|sub=type',
  SETUP_CHANNEL_MENU: 'ps|setup|sub=channel',
};

// パネル内部で使用するID（ここのファイル外では直接使わない）
const INNER_ID = {
  // driver shift panel
  DRIVER_NOW_AVAILABLE: 'ride|shift|sub=on',
  DRIVER_CLOCK_OUT: 'ride|shift|sub=off',

  // driver reg
  DRIVER_REGISTER: 'reg|driver|sub=button',

  // user reg
  USER_REGISTER: 'reg|user|sub=button',

  // lists / moderation
  DRIVERLIST_EDIT: 'admin|driver_list|sub=edit',
  DRIVERLIST_DELETE: 'admin|driver_list|sub=delete',
  USERCHECK_REFRESH: 'user|check|sub=refresh',
};

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
}

async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await safeEphemeral(interaction, '⚠️ この操作は管理者のみ実行できます。');
    return false;
  }
  return true;
}

function ensureSendableChannel(interaction) {
  const ch = interaction.channel;
  if (!ch) return null;

  // Text / Announcement のみ送信可
  if (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement) {
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
  return new EmbedBuilder().setTitle(title).setDescription(description);
}

module.exports = {
  CUSTOM_ID,
  PANEL_SETUP_IDS,
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
