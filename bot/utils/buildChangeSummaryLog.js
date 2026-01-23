/**
 * 変更点サマリーログを生成
 * @param {Array} changes - 変更点の配列
 * @param {Object} fieldLabels - フィールド名の日本語ラベルマッピング（オプション）
 * @returns {string|null} 変更点ログ、変更がない場合はnull
 */
function buildChangeSummaryLog(changes, fieldLabels = {}) {
  if (!changes.length) return null;

  const timestamp = new Date().toLocaleString('ja-JP');

  // デフォルトラベル
  const defaultLabels = {
    nickname: 'ニックネーム',
    whooId: 'whooアカウントID',
    car: '車種/カラー/ナンバー',
    capacity: '乗車人数',
    storeName: '店舗名',
    mark: '目印',
  };

  const labels = { ...defaultLabels, ...fieldLabels };

  let content = `
────────────────────
📝 変更点サマリー
────────────────────
`;

  for (const change of changes) {
    const fieldName = labels[change.field] || change.field;
    content += `・${fieldName}：
  変更前：${change.before ?? '未設定'}
  変更後：${change.after ?? '未設定'}

`;
  }

  content += `・更新日時：${timestamp}`;

  return content.trim();
}

module.exports = {
  buildChangeSummaryLog,
};
