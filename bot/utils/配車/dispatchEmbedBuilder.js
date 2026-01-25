const { EmbedBuilder } = require('discord.js');

/**
 * 送迎管理用 共通Embedを生成 (High-Performance Edition)
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
        forcedEndTime = '--:--',
        date = '--/--'
    } = data;

    // ステータス表示
    const STATUS_MAP = {
        MATCHED: 'マッチング',
        HEADING: '向かっています',
        STARTED: '送迎中',
        IN_SERVICE: '送迎中',
        COMPLETED: '終了',
        FORCED: '終了 (強制)',
        CANCELLED: 'キャンセル'
    };
    let statusText = STATUS_MAP[status] || '進行中';

    // 相乗り者地点に向かっている場合の特殊表示
    if (status === 'HEADING' && data.carpoolUsers && data.carpoolUsers.length > 0) {
        const hasUnpickedCarpool = data.carpoolUsers.some(u => !u.pickedUp);
        if (hasUnpickedCarpool) {
            statusText = '相乗り者地点に向かっています';
        }
    }

    // 色設定
    const COLOR_MAP = {
        MATCHED: 0xFFFF00, // 黄
        HEADING: 0x3498db, // 青
        STARTED: 0x2ecc71, // 緑
        IN_SERVICE: 0x2ecc71, // 緑
        COMPLETED: 0x95a5a6, // グレー
        FORCED: 0xe74c3c, // 赤
        CANCELLED: 0xe67e22 // 橙
    };
    const color = COLOR_MAP[status] || 0x3498db;

    // タイトル: MM/DD HH:mm~HH:mm 【方面】→【方面】
    const title = `${date} ${matchTime}~${endTime} 【${pickup}】→【${target}】`;

    const embed = new EmbedBuilder()
        .setTitle(title.substring(0, 256))
        .setColor(color)
        .setDescription([
            `送迎：【${pickup}】→【${target}】`,
            `現在の状況：${statusText}`,
            '',
            `日程：${date} | マッチング：${matchTime}`,
            `送迎開始時間： ${startTime} ｜ 送迎終了時間： ${endTime}`,
            `送迎強制終了時間： ${forcedEndTime}`,
            '',
            '👤 メンバー',
            `送迎者：<@${driverId}>`,
            `利用者：<@${userId}>`,
            ...(data.carpoolUsers || []).map(u => `相乗り者：<@${u.userId}>`),
            '',
            '⏱️ 進捗ログ',
            `向かっています：${headingTime === '--:--' ? '(未完了)' : headingTime}`,
            `送迎開始：${startTime === '--:--' ? '(未完了)' : startTime}`,
            `送迎終了：${endTime === '--:--' ? '(未完了)' : endTime}`,
            '',
            ...(data.carpoolUsers || []).map((u, i) =>
                `**相乗り${i + 1}** 向かっています：${u.headingTime || '--:--'} | 開始：${u.startTime || '--:--'} | 終了：${u.endTime || '--:--'}`
            ),
        ].join('\n'))
        .setTimestamp();

    const username = data.client?.user?.username || '送迎bot';
    const avatarURL = data.client?.user?.displayAvatarURL?.() || null;

    return embed.setFooter({
        text: `${username}｜${new Date().toLocaleString('ja-JP')}`,
        iconURL: avatarURL
    });
}

module.exports = { buildDispatchEmbed };
