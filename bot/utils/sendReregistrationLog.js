/**
 * 再登録ログをメモチャンネルへ送信
 * @param {TextChannel} channel - メモチャンネル
 * @param {string} role - 役割 ('driver' または 'user')
 */
async function sendReregistrationLog(channel, role = 'driver') {
  const timestamp = new Date().toLocaleString('ja-JP');
  const roleLabel = role === 'driver' ? '送迎者' : '利用者';

  const content = `
────────────────────
🔁 再登録ログ
────────────────────
・登録区分：${roleLabel}
・理由：内容更新（車種／区域／登録修正 等）
・再登録日時：${timestamp}`;

  await channel.send({ content: content.trim() });
}

module.exports = {
  sendReregistrationLog,
};
