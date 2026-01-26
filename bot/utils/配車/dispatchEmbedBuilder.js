const buildPanelEmbed = require('../embed/embedTemplate');
const { RideStatus } = require('../constants');

/**
 * 送迎管理用 共通Embedを生成 (High-Performance Edition)
 * @param {Object} data
 */
function buildDispatchEmbed(data) {
    const {
        pickup,
        target,
        status,
        driverId,
        driverPlace, // Added
        userId,
        matchTime = '--:--',
        headingTime = '--:--',
        startTime = '--:--',
        endTime = '--:--',
        forcedEndTime = '--:--',
        date = '--/--',
        client
    } = data;

    // ステータス表示
    const STATUS_MAP = {
        [RideStatus.MATCHED]: 'マッチング',
        HEADING: '向かっています', // Legacy mapping fallback
        [RideStatus.APPROACHING]: '向かっています',
        [RideStatus.STARTED]: '送迎中',
        [RideStatus.COMPLETED]: '終了',
        COMPLETED: '終了', // Alias
        STARTED: '送迎中', // Alias
        IN_SERVICE: '送迎中', // Alias
        FORCED: '終了 (強制)',
        [RideStatus.CANCELLED]: 'キャンセル'
    };
    let statusText = STATUS_MAP[status] || '送迎中';

    // 相乗り者地点に向かっている場合の特殊表示
    if (status === RideStatus.APPROACHING && data.carpoolUsers && data.carpoolUsers.length > 0) {
        const hasUnpickedCarpool = data.carpoolUsers.some(u => !u.pickedUp);
        if (hasUnpickedCarpool) {
            statusText = '相乗り者地点に向かっています';
        }
    }

    // 型マッピング
    const TYPE_MAP = {
        [RideStatus.MATCHED]: 'warning',
        [RideStatus.APPROACHING]: 'info',
        [RideStatus.STARTED]: 'success',
        [RideStatus.COMPLETED]: 'info', // 終了時は履歴として案内型
        FORCED: 'error',
        [RideStatus.CANCELLED]: 'error'
    };
    const type = TYPE_MAP[status] || 'info';

    // タイトル: MM/DD HH:mm~HH:mm 【DriverPlace】→【Pickup】→【Target】
    const startPlace = driverPlace || '不明';
    const title = `${date} ${matchTime}~${endTime} 【${startPlace}】→【${pickup}】→【${target}】`;

    return buildPanelEmbed({
        title: title.substring(0, 256),
        description: [
            `送迎：【${startPlace}】→【${pickup}】→【${target}】`,
            `現在の状況：**${statusText}**`,
            '',
            `日程：${date} | マッチング：${matchTime}`,
            `向かっています： ${headingTime}`,
            `送迎開始時間： ${startTime}`,
            `送迎終了時間： ${endTime}`,
            `送迎強制終了時間： ${forcedEndTime}`,
            '',
            '👤 メンバー',
            `送迎者：<@${driverId}>`,
            `利用者：<@${userId}>`,
            ...(data.carpoolUsers || []).map(u => `相乗り者：<@${u.userId}>`),
            '',
            ...(data.carpoolUsers || []).map((u, i) =>
                `**相乗り${i + 1}** 向かっています：${u.headingTime || '--:--'} | 開始：${u.startTime || '--:--'} | 終了：${u.endTime || '--:--'}`
            ),
        ].join('\n'),
        type,
        client
    });
}

module.exports = { buildDispatchEmbed };
