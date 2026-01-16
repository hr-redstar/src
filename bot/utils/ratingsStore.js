const store = require('./ストレージ/ストア共通');
const paths = require('./ストレージ/ストレージパス');

/**
 * 評価サマリーを取得（なければ再計算）
 */
async function getRatingSummary(guildId, userId, role) {
    const summaryPath = role === 'driver'
        ? paths.driverRatingSummaryJson(guildId, userId)
        : paths.userRatingSummaryJson(guildId, userId);

    let summary = await store.readJson(summaryPath).catch(() => null);

    // サマリーがない、または古い場合は再計算（今回は常に再計算は重いので、基本は読み込み、キャッシュ戦略は呼び出し元次第だが、
    // ここでは簡略化のため「ファイルがなければ計算」とする。更新トリガーは別途 saveRating で掛ける）
    if (!summary) {
        summary = await recalculateRatingSummary(guildId, userId, role);
    }
    return summary;
}

/**
 * 評価サマリーを再計算して保存
 */
async function recalculateRatingSummary(guildId, userId, role) {
    // ルートディレクトリ特定
    const rootPath = role === 'driver'
        ? paths.driverRatingJson(guildId, userId, '9999', '99', '99').split('/口コミ/')[0] + '/口コミ'
        : paths.userRatingJson(guildId, userId, '9999', '99', '99').split('/口コミ/')[0] + '/口コミ';

    // 全ファイル取得
    const files = await store.listKeys(rootPath).catch(() => []);
    const ratingFiles = files.filter(f => f.endsWith('.json') && !f.endsWith('summary.json'));

    const stats = {
        totalStars: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        comments: [], // 最新10件
        updatedAt: new Date().toISOString()
    };

    const allRatings = [];

    // ファイル読み込み & 集計
    for (const file of ratingFiles) {
        const dayRatings = await store.readJson(file).catch(() => []);
        if (Array.isArray(dayRatings)) {
            for (const r of dayRatings) {
                // 重複排除ロジックが必要ならここに入れるが、基本は保存時にdispatchIdで管理されている
                allRatings.push(r);

                if (r.stars) {
                    const s = parseInt(r.stars);
                    if (s >= 1 && s <= 5) {
                        stats.distribution[s]++;
                        stats.totalStars += s;
                        stats.count++;
                    }
                }
            }
        }
    }

    // コメント抽出（日付降順）
    const comments = allRatings
        .filter(r => r.comment && r.comment.length > 0)
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        .slice(0, 10);

    stats.comments = comments;
    stats.average = stats.count > 0 ? (stats.totalStars / stats.count).toFixed(1) : 0;

    // 保存
    const summaryPath = role === 'driver'
        ? paths.driverRatingSummaryJson(guildId, userId)
        : paths.userRatingSummaryJson(guildId, userId);

    await store.writeJson(summaryPath, stats);

    return stats;
}

module.exports = {
    getRatingSummary,
    recalculateRatingSummary
};
