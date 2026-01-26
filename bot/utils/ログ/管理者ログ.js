// utils/ログ/管理者ログ.js
const buildPanelEmbed = require('../embed/embedTemplate');
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

  // 管理者ログのスレッド（v2.9.3: スレッドがない場合は送信しないポリシー）
  const targetChannelId = config.logs?.adminLogThread;
  if (!targetChannelId) return;

  const baseChannel =
    guild.channels.cache.get(targetChannelId) ||
    (await guild.channels.fetch(targetChannelId).catch(() => null));
  if (!baseChannel || !baseChannel.isTextBased()) return;

  const embed = buildPanelEmbed({
    title: title.startsWith('📌') ? title : `📌 ${title}`,
    description: `**${description}**\n\n**実行者：** <@${user.id}>`,
    color: 0x2ecc71, // 成功を表す緑
    client: guild.client,
  });

  // チャンネルに直接送信
  await baseChannel.send({ embeds: [embed] }).catch(() => null);
}

module.exports = {
  postAdminActionLog,
};
