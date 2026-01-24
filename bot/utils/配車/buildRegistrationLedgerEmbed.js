// src/bot/utils/配車/buildRegistrationLedgerEmbed.js
const { EmbedBuilder } = require('discord.js');

/**
 * 送迎者用の台帳Embedを作成
 */
function buildDriverLedgerEmbed(d, user, ratingSummary) {
    const stars = ratingSummary?.average ? `⭐ **${ratingSummary.average}** (${ratingSummary.count}件)` : '⭐ 新規 (評価なし)';

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${d.nickname || user.username} 様`,
            iconURL: user.displayAvatarURL(),
        })
        .setColor(0x2ecc71)
        .setDescription(
            `**▼ <@${d.userId}>**　${stars}\n\n` +
            `**ニックネーム**: ${d.nickname || '未設定'}\n` +
            `**車種/カラー/ナンバー**: ${d.car || '未設定'}\n` +
            `**乗車人数**: ${d.capacity || '0'}名\n` +
            `**whooID**: ${d.whooId || '未設定'}`
        )
        .setFooter({ text: `userId: ${d.userId}` })
        .setTimestamp();

    return embed;
}

/**
 * 利用者用の台帳Embedを作成
 */
function buildUserLedgerEmbed(u, user, ratingSummary) {
    const stars = ratingSummary?.average ? `⭐ **${ratingSummary.average}** (${ratingSummary.count}件)` : '⭐ 新規 (評価なし)';

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${u.storeName || user.username} 様`,
            iconURL: user.displayAvatarURL(),
        })
        .setColor(0x3498db)
        .setDescription(
            `**▼ <@${u.userId}>**　${stars}\n\n` +
            `**店舗名/ニックネーム**: ${u.storeName || '未設定'}\n` +
            `**方面**: ${u.address || '未設定'}`
        )
        .setFooter({ text: `userId: ${u.userId}` })
        .setTimestamp();

    return embed;
}

module.exports = {
    buildDriverLedgerEmbed,
    buildUserLedgerEmbed,
};
