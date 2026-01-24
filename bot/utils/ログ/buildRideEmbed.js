const { buildDispatchEmbed } = require('../配車/dispatchEmbedBuilder');

/**
 * 運営者ログ用Embedを生成する (v2.9.0 Professional Edition)
 */
function buildRideEmbed({ status, data }) {
    // 既存データとの互換性を保ちつつ変換
    const embedData = {
        pickup: data.pickup || data.area || '不明',
        target: data.target || data.direction || '不明',
        status: status,
        driverId: data.driverId,
        userId: data.userId,
        matchTime: data.matchTime,
        headingTime: data.headingTime,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date
    };

    return buildDispatchEmbed(embedData);
}

module.exports = {
    buildRideEmbed,
};
