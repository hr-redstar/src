const { getThreadRange, rangeToWeeks, formatThreadName } = require('./threadRangeCalculator');

/**
 * スレッドを作成または取得
 * @param {TextChannel} channel - メモチャンネル
 * @param {Object} threadPolicy - スレッドポリシー設定
 * @param {Date} registrationDate - 登録日時
 * @returns {Promise<ThreadChannel|null>} 作成または取得したスレッド
 */
async function getOrCreateHistoryThread(channel, threadPolicy, registrationDate) {
  const period = threadPolicy?.period || threadPolicy?.range;
  if (!threadPolicy?.enabled || !period) {
    return null; // スレッド作成なし
  }

  const weeks = rangeToWeeks(period);
  if (weeks === 0) return null;

  const { start, end } = getThreadRange(registrationDate, weeks);
  const threadName = formatThreadName(start, end);

  // 既存のスレッドを検索
  const existingThreads = await channel.threads.fetchActive().catch(() => ({ threads: new Map() }));
  let thread = existingThreads.threads.find((t) => t.name === threadName);

  if (!thread) {
    // アーカイブされたスレッドも確認
    const archivedThreads = await channel.threads
      .fetchArchived()
      .catch(() => ({ threads: new Map() }));
    thread = archivedThreads.threads.find((t) => t.name === threadName);
  }

  // スレッドが存在しない場合は作成
  if (!thread) {
    thread = await channel.threads
      .create({
        name: threadName,
        autoArchiveDuration: 10080, // 1週間
        reason: `履歴スレッド作成（期間: ${threadName}）`,
      })
      .catch((err) => {
        console.error('スレッド作成エラー:', err);
        return null;
      });
  }

  return thread;
}

module.exports = {
  getOrCreateHistoryThread,
};
