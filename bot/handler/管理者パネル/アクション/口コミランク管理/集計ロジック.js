const store = require('../../../../utils/ストレージ/ストア共通');
const paths = require('../../../../utils/ストレージ/ストレージパス');

/**
 * ユーザー（送迎者または利用者）の評価統計を算出する
 * @param {string} guildId
 * @param {string} userId
 * @returns {Promise<Object>} 統計データ
 */
async function aggregateUserRatings(guildId, userId) {
  const stats = {
    average: 0,
    totalCount: 0,
    starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    commentCount: 0,
    comments: [],
    type: '不明',
  };

  // 送迎者としての評価と利用者としての評価の両方のフォルダを走査
  const driverRatingDir = `${paths.driverRoot(guildId)}/${userId}/口コミ`;
  const userRatingDir = `${paths.userRoot(guildId)}/${userId}/口コミ`;

  const [driverFiles, userFiles] = await Promise.all([
    store.listKeys(driverRatingDir).catch(() => []),
    store.listKeys(userRatingDir).catch(() => []),
  ]);

  const allRatingFiles = [
    ...driverFiles.filter((f) => f.endsWith('.json')),
    ...userFiles.filter((f) => f.endsWith('.json')),
  ];

  let sumStars = 0;

  for (const filePath of allRatingFiles) {
    // 新仕様では1ファイルに評価の配列が入っている
    const list = await store.readJson(filePath).catch(() => []);
    if (!Array.isArray(list)) continue;

    for (const entry of list) {
      // entry: { stars, comment, raterId, updatedAt, dispatchId }
      if (entry.stars) {
        const s = entry.stars;
        stats.starCounts[s] = (stats.starCounts[s] || 0) + 1;
        sumStars += s;
        stats.totalCount++;
      }
      if (entry.comment) {
        stats.commentCount++;
        stats.comments.push({
          text: entry.comment,
          raterId: entry.raterId,
          stars: entry.stars,
          date: entry.updatedAt,
        });
      }
    }
  }

  // 保存パスからタイプを推測（簡易的）
  if (driverFiles.length > 0) stats.type = '送迎者';
  else if (userFiles.length > 0) stats.type = '利用者';

  if (stats.totalCount > 0) {
    stats.average = Math.round((sumStars / stats.totalCount) * 10) / 10;
    // コメントを日付新しい順にソート
    stats.comments.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  return stats;
}

module.exports = { aggregateUserRatings };
