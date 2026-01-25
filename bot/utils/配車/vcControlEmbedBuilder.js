const { EmbedBuilder } = require('discord.js');

/**
 * 送迎VCコントロール用Embedを作成
 * @param {Object} data - dispatchData
 * @returns {EmbedBuilder}
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
        isExtended
    } = data;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
    const mTime = matchTime || '--:--';
    const endTimeDisplay = (driverEndTime && userEndTime) ? (driverEndTime) : '--:--';
    const currentRoute = route || `【${driverPlace || '現在地'}】→【${mark || pickup || '方面'}】→【${destination || target || '目的地'}】`;

    // タイトル: 月日 HH:mm~HH:mm 【方面】→【方角】
    const title = `${dateStr} ${mTime}~${endTimeDisplay} ${currentRoute}`;

    // ステータスに応じた配色
    let color = 0xFFFF00; // マッチング時：黄
    if (isExtended) {
        color = 0xff0000; // 期限延長：赤
    } else if (status === 'completed') {
        color = 0x000000; // 送迎終了：黒
    } else if (driverStartTime || userStartTime || approachTime) {
        color = 0x3498db; // 向かってます/送迎開始：青
    }

    const descriptionParts = [];

    // 相乗り者が新たに追加された際の通知テキスト
    if (carpoolUsers.length > 0) {
        const lastCarpooler = carpoolUsers[carpoolUsers.length - 1];
        // マッチングしたばかり（開始時間が未設定）の最新相乗り者がいれば表示
        if (!lastCarpooler.startTime) {
            descriptionParts.push(`📢 **相乗り希望者が来ました。**`);
            descriptionParts.push(`> 【${lastCarpooler.location || '方面'}】 <@${lastCarpooler.userId}>`);
            descriptionParts.push('');
        }
    }

    // 基本情報 (メンション)
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

    const embed = new EmbedBuilder()
        .setTitle(title.substring(0, 256))
        .setDescription(descriptionParts.join('\n'))
        .setColor(color)
        .setTimestamp();

    const username = data.client?.user?.username || '送迎bot';
    const avatarURL = data.client?.user?.displayAvatarURL?.() || null;

    return embed.setFooter({
        text: `${username}｜${new Date().toLocaleString('ja-JP')}`,
        iconURL: avatarURL
    });
}

module.exports = { buildVcControlEmbed };
