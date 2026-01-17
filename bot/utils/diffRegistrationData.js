/**
 * 登録データの差分を抽出
 * @param {Object} previousData - 前回の登録データ
 * @param {Object} currentData - 今回の登録データ
 * @returns {Array} 変更点の配列
 */
function diffRegistrationData(previousData, currentData) {
  const changes = [];

  for (const key of Object.keys(currentData)) {
    const before = previousData?.[key] ?? null;
    const after = currentData[key];

    if (before !== after) {
      changes.push({
        field: key,
        before,
        after,
      });
    }
  }

  return changes;
}

module.exports = {
  diffRegistrationData,
};
