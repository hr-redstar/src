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
    } = data;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

    // 最終的なルート表示
    const currentRoute = route || `【${driverPlace}】→【${mark}】→【${destination}】`;
    // タイトル：月日 HH:mm~終了時間 ルート
    // 終了時間は driverEndTime と userEndTime 両方が入った時のみ? 
    // 仕様では「マッチング時間~送迎終了時間」
    const endTimeDisplay = (driverEndTime && userEndTime) ? (driverEndTime) : '--:--';
    const title = `${dateStr} ${matchTime}~${endTimeDisplay} ${currentRoute}`;

    const descriptionParts = [];

    // 1行目: 送迎者・利用者メンション
    descriptionParts.push(`送迎者：<@${driverId}>　利用者：<@${userId}>`);

    // 2行目: マッチング・向かってます
    descriptionParts.push(`マッチング時間：${matchTime}　向かっています：${approachTime || '--:--'}`);
    descriptionParts.push(''); // 空行

    // 3-4行目: 送迎者・利用者の開始/終了時間
    descriptionParts.push(`送迎者　送迎開始時間：${driverStartTime || '--:--'} ｜ 送迎終了時間：${driverEndTime || '--:--'}`);
    descriptionParts.push(`利用者　送迎開始時間：${userStartTime || '--:--'} ｜ 送迎終了時間：${userEndTime || '--:--'}`);

    // 相乗り者がいる場合の処理
    if (carpoolUsers && carpoolUsers.length > 0) {
        descriptionParts.push(''); // 空行
        carpoolUsers.forEach((u, index) => {
            const idx = index + 1;
            descriptionParts.push(`相乗り希望者${idx}が来ました。`);
            descriptionParts.push(`【${u.location || '方面・目的地'}】<@${u.userId}>`);
            descriptionParts.push(`相乗り${idx}　相乗り開始時間：${u.startTime || '--:--'} ｜ 相乗り終了時間：${u.endTime || '--:--'}`);
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(title.substring(0, 256))
        .setDescription(descriptionParts.join('\n'))
        .setColor(0x3498db)
        .setTimestamp();

    // 完了状態の色
    if (data.status === 'completed') {
        embed.setColor(0x95a5a6); // Gray
    }

    return embed;
}

module.exports = { buildVcControlEmbed };
