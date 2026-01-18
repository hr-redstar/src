// src/bot/utils/配車/buildRegistrationLedgerEmbed.js
const { EmbedBuilder } = require('discord.js');

/**
 * 送迎者用の台帳Embedを作成
 */
function buildDriverLedgerEmbed(d, user, ratingSummary) {
    const stars = ratingSummary?.average ? `⭐ **${ratingSummary.average}** (${ratingSummary.count}件)` : '⭐ 新規 (評価なし)';

    const embed = new EmbedBuilder()
        .setAuthor({
            name: `${d.nickname || user.username}（送迎者）`,
            iconURL: user.displayAvatarURL(),
        })
        .setColor(0x2ecc71) // 緑
        .setDescription(
            `**▼ <@${d.userId}>**　${stars}\n` +
            `> 【ニックネーム】${d.nickname || '未設定'}\n` +
            `> 【区域】${d.area || '未設定'} 【停留場所】${d.stop || '未設定'}\n` +
            `> 【車種・ナンバー】${d.car || '未設定'}【人数】${d.capacity || '0'}名`
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
            name: `${u.storeName || user.username}（利用者）`,
            iconURL: user.displayAvatarURL(),
        })
        .setColor(0x3498db) // 青
        .setDescription(
            `**▼ <@${u.userId}>**　${stars}\n` +
            `> 【お名前】${u.storeName || '未設定'}\n` +
            `> 【住所】${u.address || '未設定'}\n` +
            `> 【駐車目印】${u.mark || '未設定'}`
        )
        .setFooter({ text: `userId: ${u.userId}` })
        .setTimestamp();

    return embed;
}

module.exports = {
    buildDriverLedgerEmbed,
    buildUserLedgerEmbed,
};
