// utils/ログ/buildRideEmbed.js
const { buildDispatchEmbed } = require('../配車/dispatchEmbedBuilder');

/**
 * 運営者ログ用Embedを生成する (v2.9.0 High-Performance Edition)
 */
function buildRideEmbed({ status, data }) {
    // 全てのデータを引き継ぎつつ、EmbedBuilderが必要な形式に整える
    const embedData = {
        ...data,
        pickup: data.pickup || data.area || '不明',
        target: data.target || data.direction || '不明',
        status: status,
        forcedEndTime: data.forcedEndTime || data.forced_end_time || '--:--',
    };

    return buildDispatchEmbed(embedData);
}

module.exports = {
    buildRideEmbed,
};
