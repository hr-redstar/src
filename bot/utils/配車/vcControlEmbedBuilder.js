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
        status
    } = data;

    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;

    // 最終的なルート表示
    const currentRoute = route || `【${driverPlace || '不明'}】→【${mark || '不明'}】→【${destination || '不明'}】`;
    const mTime = matchTime || '--:--';
    const endTimeDisplay = (driverEndTime && userEndTime) ? (driverEndTime) : '--:--';
    const title = `🚗 送迎管理：${currentRoute}`;

    const descriptionParts = [];

    // ステータス表示
    let statusLabel = '📋 マッチング済み';
    let color = 0xffd700; // Gold (Active)

    if (status === 'completed') {
        statusLabel = '✅ 送迎完了';
        color = 0x95a5a6; // Gray
    } else if (driverStartTime || userStartTime) {
        statusLabel = '🚀 送迎中';
        color = 0x2ecc71; // Green
    } else if (approachTime) {
        statusLabel = '🚙 向かっています';
        color = 0x3498db; // Blue
    }

    descriptionParts.push(`**現在の状況：${statusLabel}**`);
    descriptionParts.push(`日程：${dateStr} | マッチング：${mTime} | 終了：${endTimeDisplay}`);
    descriptionParts.push('');

    // 送迎対象者情報
    const passengerId = userId || '未定';
    descriptionParts.push(`👤 **主要メンバー**`);
    descriptionParts.push(`> 送迎者：<@${driverId}>`);
    descriptionParts.push(`> 利用者：${passengerId.startsWith('<@') ? passengerId : `<@${passengerId}>`}`);
    descriptionParts.push('');

    // 各自のタイムスタンプ
    descriptionParts.push(`⏱️ **進捗ログ**`);
    descriptionParts.push(`> 向かっています：${approachTime || '--:--'}`);
    descriptionParts.push(`> 送迎者開始：${driverStartTime || '--:--'} | 終了：${driverEndTime || '--:--'}`);
    descriptionParts.push(`> 利用者開始：${userStartTime || '--:--'} | 終了：${userEndTime || '--:--'}`);

    // 相乗り者がいる場合の処理
    if (carpoolUsers && carpoolUsers.length > 0) {
        descriptionParts.push('');
        descriptionParts.push(`👥 **相乗り利用者 (${carpoolUsers.length}名)**`);
        carpoolUsers.forEach((u, index) => {
            const idx = index + 1;
            descriptionParts.push(`> ${idx}. <@${u.userId}> (${u.location || '方面・目的地'})`);
            descriptionParts.push(`> 　 開始：${u.startTime || '--:--'} | 終了：${u.endTime || '--:--'}`);
        });
    }

    const embed = new EmbedBuilder()
        .setTitle(title.substring(0, 256))
        .setDescription(descriptionParts.join('\n'))
        .setColor(color)
        .setTimestamp()
        .setFooter({ text: '送迎管理システム Professional Edition' });

    return embed;
}

module.exports = { buildVcControlEmbed };
