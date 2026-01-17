/**
 * ユーザーメモチャンネル名を生成
 * @param {GuildMember} member - ギルドメンバーオブジェクト
 * @returns {string} チャンネル名
 */
function buildUserMemoChannelName(member) {
  // ニックネーム優先で表示名を取得
  const rawName = member.nickname || member.displayName || member.user.username;

  // Discord チャンネル名制限に対応した安全な名前に整形
  const safeName = rawName
    .replace(/\s+/g, '-') // 空白を -
    .replace(/[^\w\u3000-\u9FFF\-｜]/g, '') // 記号除去（日本語・｜は保持）
    .slice(0, 50); // 長すぎ防止

  return `ユーザーメモ｜${safeName}`;
}

module.exports = {
  buildUserMemoChannelName,
};
