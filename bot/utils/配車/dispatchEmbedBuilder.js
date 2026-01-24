const { EmbedBuilder } = require('discord.js');

/**
 * 送迎管理用 共通Embedを生成 (Professional Edition)
 * @param {Object} data 
 * @param {string} data.pickup - 利用者方面 (店舗住所・目印相当)
 * @param {string} data.target - 目的地方角
 * @param {string} data.status - MATCHED, HEADING, STARTED, COMPLETED, FORCED
 * @param {string} data.driverId 
 * @param {string} data.userId 
 * @param {string} [data.matchTime] - HH:mm
 * @param {string} [data.headingTime] - HH:mm
 * @param {string} [data.startTime] - HH:mm
 * @param {string} [data.endTime] - HH:mm
 * @param {string} [data.date] - M/D
 */
function buildDispatchEmbed(data) {
    const {
        pickup,
        target,
        status,
        driverId,
        userId,
        matchTime = '--:--',
        headingTime = '--:--',
        startTime = '--:--',
        endTime = '--:--',
        date = '--/--'
    } = data;

    // ステータス表示
    const STATUS_MAP = {
        MATCHED: '送迎中',
        HEADING: '移動中',
        STARTED: '開始',
        COMPLETED: '終了',
        FORCED: '終了 (強制)'
    };
    const statusText = STATUS_MAP[status] || '進行中';

    // 色設定
    const COLOR_MAP = {
        MATCHED: 0xFFFF00, // 黄
        HEADING: 0x3498db, // 青
        STARTED: 0x2ecc71, // 緑
        COMPLETED: 0x95a5a6, // グレー
        FORCED: 0xe74c3c // 赤
    };
    const color = COLOR_MAP[status] || 0x3498db;

    // タイトル: MM/DD HH:mm~HH:mm 【方面】→【方角】
    const title = `${date} ${matchTime}~${endTime} 【${pickup}】→【${target}】`;

    const embed = new EmbedBuilder()
        .setTitle(title.substring(0, 256))
        .setColor(color)
        .setDescription([
            `**送迎：**【${pickup}】→【${target}】`,
            `**現在の状況：**${statusText}`,
            `**日程：**${date} | **マッチング：**${matchTime} | **終了：**${endTime}`,
            '',
            '👤 **主要メンバー**',
            `送迎者：<@${driverId}>`,
            `利用者：<@${userId}>`,
            '',
            '⏱️ **進捗ログ**',
            `向かっています：${headingTime === '--:--' ? '' : headingTime}`,
            `送迎者開始：${startTime === '--:--' ? '' : startTime} | 終了：${endTime === '--:--' ? '' : endTime}`
        ].join('\n'))
        .setTimestamp()
        .setFooter({ text: 'High-Performance Dispatch Management System v2.9' });

    return embed;
}

module.exports = { buildDispatchEmbed };
