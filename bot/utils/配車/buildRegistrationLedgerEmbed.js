const buildPanelEmbed = require('../embed/embedTemplate');

/**
 * 送迎者用の台帳Embedを作成
 */
function buildDriverLedgerEmbed(d, user, ratingSummary) {
    const stars = ratingSummary?.average ? `⭐ **${ratingSummary.average}** (${ratingSummary.count}件)` : '⭐ 新規 (評価なし)';

    return buildPanelEmbed({
        title: `${d.nickname || user.username} 様`,
        thumbnail: user.displayAvatarURL(),
        description: [
            `**▼ <@${d.userId}>**　${stars}`,
            '',
            `**ニックネーム**: ${d.nickname || '未設定'}`,
            `**車種/カラー/ナンバー**: ${d.car || '未設定'}`,
            `**乗車人数**: ${d.capacity || '0'}名`,
            `**whooID**: ${d.whooId || '未設定'}`,
            '',
            `**userId**: \`${d.userId}\``
        ].join('\n'),
        type: 'success',
        client: user.client
    });
}

/**
 * 利用者用の台帳Embedを作成
 */
function buildUserLedgerEmbed(u, user, ratingSummary) {
    const stars = ratingSummary?.average ? `⭐ **${ratingSummary.average}** (${ratingSummary.count}件)` : '⭐ 新規 (評価なし)';

    return buildPanelEmbed({
        title: `${u.storeName || user.username} 様`,
        thumbnail: user.displayAvatarURL(),
        description: [
            `**▼ <@${u.userId}>**　${stars}`,
            '',
            `**店舗名/ニックネーム**: ${u.storeName || '未設定'}`,
            `**方面**: ${u.address || '未設定'}`,
            '',
            `**userId**: \`${u.userId}\``
        ].join('\n'),
        type: 'info',
        client: user.client
    });
}

module.exports = {
    buildDriverLedgerEmbed,
    buildUserLedgerEmbed,
};
