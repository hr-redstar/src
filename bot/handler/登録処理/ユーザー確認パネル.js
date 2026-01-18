const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const store = require('../../utils/ストレージ/ストア共通');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const { applyVisibility } = require('../../utils/共通/visibilityManager');
const { buildDriverLedgerEmbed, buildUserLedgerEmbed } = require('../../utils/配車/buildRegistrationLedgerEmbed');

/**
 * 登録情報管理用のスレッドを取得または作成する
 */
async function getOrCreateInfoThread(channel, name, operatorRoleId) {
  const threads = await channel.threads.fetchActive();
  let thread = threads.threads.find(t => t.name === name);

  if (!thread) {
    thread = await channel.threads.create({
      name,
      autoArchiveDuration: 1440,
      reason: 'ユーザー登録情報管理',
    });
  }

  // 公開制限の適用
  await applyVisibility(thread, operatorRoleId);

  return thread;
}

/**
 * 台帳（スレッド内メッセージ）を1件更新または新規作成する
 */
async function upsertRegistrationLedger(guild, type, data) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.userCheckPanel;
  if (!panel || !panel.channelId) return null;

  const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!channel) return null;

  const threadName = type === 'driver' ? '🚗 送迎者登録情報' : '👤 利用者登録情報';
  const thread = await getOrCreateInfoThread(channel, threadName, config.operatorRoleId);

  // 既存メッセージの検索 (直近100件)
  const messages = await thread.messages.fetch({ limit: 100 });
  const target = messages.find(m => m.embeds[0]?.footer?.text === `userId: ${data.userId}`);

  const user = await guild.client.users.fetch(data.userId).catch(() => null);
  if (!user) return null;

  // 評価サマリーの取得 (v1.5.0)
  const { getRatingSummary } = require('../../utils/ratingsStore');
  const ratingSummary = await getRatingSummary(guild.id, data.userId, type);

  const embed = type === 'driver' ? buildDriverLedgerEmbed(data, user, ratingSummary) : buildUserLedgerEmbed(data, user, ratingSummary);

  if (target) {
    await target.edit({ embeds: [embed] });
    return target;
  } else {
    return await thread.send({ embeds: [embed] });
  }
}

/**
 * ユーザー確認パネルのメッセージペイロードを生成
 */
async function buildUserCheckPanelMessage(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.userCheckPanel;
  const channelId = panel?.channelId;
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;

  let driverThreadLink = '未作成';
  let userThreadLink = '未作成';

  if (channel) {
    const threadNameD = '🚗 送迎者登録情報';
    const threadNameU = '👤 利用者登録情報';

    const threads = await channel.threads.fetchActive();
    const tD = threads.threads.find(t => t.name === threadNameD);
    const tU = threads.threads.find(t => t.name === threadNameU);

    if (tD) driverThreadLink = `[🔗 送迎者台帳を表示する](https://discord.com/channels/${guild.id}/${tD.id})`;
    if (tU) userThreadLink = `[🔗 利用者台帳を表示する](https://discord.com/channels/${guild.id}/${tU.id})`;
  }

  const botClient = client || guild.client;
  const embed = buildPanelEmbed({
    title: 'ユーザー登録状況',
    description: '現在の登録状況を台帳スレッドで確認・管理します。',
    client: botClient,
    color: 0x3498db,
  });

  embed.addFields(
    { name: '🚗 送迎者台帳', value: driverThreadLink, inline: false },
    { name: '👤 利用者台帳', value: userThreadLink, inline: false }
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ps|check')
      .setLabel('自分の登録情報を確認')
      .setStyle(ButtonStyle.Primary)
  );

  return buildPanelMessage({ embed, components: [row] });
}

const { sendOrUpdatePanel } = require('../共通/パネル送信');

/**
 * ユーザー確認パネルを送信 or 更新する
 */
async function updateUserCheckPanel(guild, client) {
  const config = await loadConfig(guild.id);
  const panel = config.panels?.userCheckPanel;

  if (!panel || !panel.channelId) return;

  const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
  if (!channel) return;

  // 秘匿化の適用
  await applyVisibility(channel, config.operatorRoleId);

  const newMessageId = await sendOrUpdatePanel({
    channel,
    messageId: panel.messageId,
    buildMessage: async () => buildUserCheckPanelMessage(guild, client),
    suppressFallback: true,
  });

  if (newMessageId && newMessageId !== panel.messageId) {
    if (!config.panels) config.panels = {};
    if (!config.panels.userCheckPanel) config.panels.userCheckPanel = {};
    config.panels.userCheckPanel.messageId = newMessageId;
    await saveConfig(guild.id, config);
  }
}

module.exports = {
  buildUserCheckPanelMessage,
  updateUserCheckPanel,
  upsertRegistrationLedger,
};
