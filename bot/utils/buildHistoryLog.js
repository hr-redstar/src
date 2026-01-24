/**
 * 過去の登録情報ブロックを生成
 * @param {Object} historyData - history配列の1要素
 * @param {string} role - 役割 ('driver' または 'user')
 * @returns {string} 過去の登録情報ログ
 */
function buildHistoryLog(historyData, role = 'driver') {
  if (!historyData) return null;

  const oldRegisteredAt = historyData.oldRegisteredAt
    ? new Date(historyData.oldRegisteredAt).toLocaleString('ja-JP')
    : '不明';
  const changedAt = historyData.changedAt
    ? new Date(historyData.changedAt).toLocaleString('ja-JP')
    : '不明';

  let content = `
────────────────────
🕒 過去の登録情報
────────────────────
`;

  // 送迎者の場合
  if (role === 'driver') {
    content += `・登録時ニックネーム：${historyData.nickname || '未設定'}
・車種/カラー/ナンバー：${historyData.car || '未設定'}
・乗車人数：${historyData.capacity || '未設定'}
・whooID：${historyData.whooId || '未設定'}`;
  }
  // 利用者の場合
  else if (role === 'user') {
    content += `・店舗名：${historyData.storeName || '未設定'}
・方面：${historyData.mark || '未設定'}`;
  }

  content += `

・有効期間：
　開始：${oldRegisteredAt}
　終了：${changedAt}`;

  return content.trim();
}

module.exports = {
  buildHistoryLog,
};
