const buildPanelEmbed = require('../../utils/embed/embedTemplate');

/**
 * プライベートVCガイドメッセージを生成
 * @param {CategoryChannel} category - カテゴリーチャンネル
 * @param {import('discord.js').Client} client - Discordクライアント
 * @returns {Object} メッセージペイロード
 */
function buildPrivateVcGuide(category, client) {
  const categoryName = category ? category.name : '不明なカテゴリー';

  const embed = buildPanelEmbed({
    title: '📝 プライベートVCの使い方',
    description: `
送迎がマッチングされた際に、カテゴリー：**${categoryName}** に
送迎者と利用者専用のプライベートVCチャンネルが自動で作成されます。

待ち合わせや、ルート確認、落とし物の連絡などにご利用ください。

**主要なルール**
• 送迎終了後、**7日間保存**されます。
• 期間を延ばしたい場合は **「期間延長」ボタン** を押してください。

> [!TIP]
> 運行の安全確保やプライバシーのため、第三者が無断で参加することはありません。
    `,
    color: 0x3498db,
    client: client,
  });

  return {
    content: {
      embeds: [embed],
    },
    topic: `送迎マッチング時に、カテゴリー：${categoryName} へ送迎者・利用者専用のプライベートVCが自動作成されます。送迎終了後は7日間保存されます。`,
  };
}

module.exports = {
  buildPrivateVcGuide,
};
