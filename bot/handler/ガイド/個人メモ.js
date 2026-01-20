const buildPanelEmbed = require('../../utils/embed/embedTemplate');

/**
 * 個人メモガイドメッセージを生成
 * @param {CategoryChannel} category - カテゴリーチャンネル
 * @param {import('discord.js').Client} client - Discordクライアント
 * @returns {Object} メッセージペイロード
 */
function buildUserMemoGuide(category, client) {
  const embed = buildPanelEmbed({
    title: '📝 個人メモの使い方',
    description: `
このチャンネルは **あなた専用の送迎メモ** です。
ユーザー登録時、自動で作成されます。

**主要な機能**
• 送迎に関するメモを自由に記録できます。
• VCでのやり取りが自動転送される場合があります。
• 特定のユーザーと共有したい場合は @メンションで追加可能です。

> [!NOTE]
> 運営者が管理目的以外で無断参加することはありません。プライバシーは保護されています。
    `,
    color: 0x95a5a6,
    client: client,
  });

  return {
    content: {
      embeds: [embed],
    },
    topic: 'このチャンネルはあなた専用の送迎メモです。ユーザー登録時に自動作成されます。',
  };
}

module.exports = {
  buildUserMemoGuide,
};
