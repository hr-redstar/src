// src/bot/utils/ログ/管理者ログ.js
const { EmbedBuilder } = require('discord.js');
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 管理者操作ログ（設定変更完了専用）
 * ⚠️ エラーログや自動通知には絶対に使用しないでください
 */
async function postAdminActionLog({ guild, user, title, description }) {
  // 🛑 ガード：不正呼び出し防止
  if (!guild || !user) return;
  if (!title || !description) return;

  const configPath = paths.configJson(guild.id);
  const config = await store.readJson(configPath, {});

  // 管理者ログのベースとなるチャンネル
  // 1. 管理者用ログスレッドを最優先
  // 2. 運営者ログチャンネル
  // 3. 管理者パネル設置チャンネル
  const targetChannelId =
    config.logs?.adminLogThread || config.logs?.operatorChannel || config.panels?.admin?.channelId;
  if (!targetChannelId) return;

  const baseChannel =
    guild.channels.cache.get(targetChannelId) ||
    (await guild.channels.fetch(targetChannelId).catch(() => null));
  if (!baseChannel || !baseChannel.isTextBased()) return;

  const jstNow = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });

  const embed = new EmbedBuilder()
    .setTitle(title.startsWith('📌') ? title : `📌 ${title}`)
    .setDescription(`**${description}**\n\n**実行者：** <@${user.id}>\n**日時：** ${jstNow}`)
    .setColor(0x2ecc71) // 成功を表す緑
    .setFooter({
      text: `${guild.client.user.username} | Log Management`,
      iconURL: guild.client.user.displayAvatarURL(),
    });

  // チャンネルに直接送信
  await baseChannel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  postAdminActionLog,
};
