// utils/配車/vcControlEmbedBuilder.js
const buildPanelEmbed = require('../embed/embedTemplate');

/**
 * 送迎VCコントロール用Embedを作成
 * @param {Object} data - dispatchData
 * @returns {import('discord.js').EmbedBuilder}
 */
function buildVcControlEmbed(data) {
    const {
        driverId,
        userId,
        driverPlace,
        mark,
        destination,
        matchTime,
        approachTime,
        driverStartTime,
        driverEndTime,
        userStartTime,
        userEndTime,
        carpoolUsers = [],
        route,
        status,
        isExtended,
        pickup,
        target,
        client
    } = data;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
    const mTime = matchTime || '--:--';
    const endTimeDisplay = (driverEndTime && userEndTime) ? (driverEndTime) : '--:--';
    const currentRoute = route || `【${driverPlace || '現在地'}】→【${mark || pickup || '方面'}】→【${destination || target || '目的地'}】`;

    // タイトル: 月日 HH:mm~HH:mm 【方面】→【方面】
    const title = `${dateStr} ${mTime}~${endTimeDisplay} ${currentRoute}`;

    // ステータスに応じた配色定義 (Professional Edition 型)
    let type = 'warning'; // デフォルト：イエロー (マッチング待機)
    let color = null;

    if (isExtended) {
        type = 'error'; // 期限延長：レッド
    } else if (status === 'completed' || (driverEndTime && userEndTime)) {
        color = 0x34495e; // 送迎終了：ダークグレー (デフォルト型がないため手動)
    } else if (driverStartTime || userStartTime || approachTime) {
        type = 'info'; // 向かってます/送迎開始：ブルー
    }

    const descriptionParts = [];

    // 相乗り通知
    if (carpoolUsers.length > 0) {
        const lastCarpooler = carpoolUsers[carpoolUsers.length - 1];
        if (!lastCarpooler.startTime) {
            descriptionParts.push(`📢 **相乗り希望者が来ました。**`);
            descriptionParts.push(`> 【${lastCarpooler.location || '方面'}】 <@${lastCarpooler.userId}>`);
            descriptionParts.push('');
        }
    }

    descriptionParts.push(`送迎者：<@${driverId}>　利用者：<@${userId}>`);
    descriptionParts.push(`マッチング時間：${mTime}　向かっています：${approachTime || '--:--'}`);
    descriptionParts.push(`送迎者　送迎開始：${driverStartTime || '--:--'}　終了：${driverEndTime || '--:--'}`);
    descriptionParts.push(`利用者　送迎開始：${userStartTime || '--:--'}　終了：${userEndTime || '--:--'}`);

    // 相乗り者情報
    if (carpoolUsers && carpoolUsers.length > 0) {
        descriptionParts.push('');
        carpoolUsers.forEach((u, index) => {
            const idx = index + 1;
            descriptionParts.push(`相乗り希望者${idx}：<@${u.userId}>`);
            descriptionParts.push(`相乗り${idx}　開始：${u.startTime || '--:--'}　終了：${u.endTime || '--:--'}`);
        });
    }

    return buildPanelEmbed({
        title: title.substring(0, 256),
        description: descriptionParts.join('\n'),
        type,
        color,
        client
    });
}

module.exports = { buildVcControlEmbed };

module.exports = { buildVcControlEmbed };
