const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * 相乗り募集 Embed を作成
 */
function buildCarpoolAnnouncementEmbed({
    driverLocation,
    carpoolLocation = null, // 承認済みの場合、相乗り希望者の位置が入る
    userLandmark,
    destination,
    capacity,
    currentUsers,
    departureTime,
    botName,
    isFull = false,
}) {
    const remaining = Math.max(capacity - currentUsers, 0);

    // ルート表示の組み立て
    // 承認前：【送迎者現在地】→【利用者の目印】→【目的地】
    // 承認後：【送迎者現在地】→【相乗り希望者現在地】→【利用者の目印】→【目的地】
    let routeLine = `【${driverLocation}】`;
    if (carpoolLocation) {
        routeLine += `\n→【${carpoolLocation}】`;
    }
    routeLine += `\n→【${userLandmark}】\n→【${destination}】`;

    const embed = new EmbedBuilder()
        .setTitle(isFull ? '❌ 満員です' : '🚗 相乗りできます')
        .setColor(isFull ? 0xff0000 : 0x00ff00)
        .setDescription(
            [
                isFull ? '現在満員のため、相乗りは受け付けておりません。' : `〇人まで：**${remaining}人**`,
                '',
                routeLine,
                '',
                `🕒 送迎者現在地出発時刻：${departureTime}`,
                '',
                '※ 相乗り希望後、既に合流できない場合があります。',
                '送迎可能かどうかは送迎者から連絡があります。',
            ].join('\n')
        )
        .setFooter({ text: botName })
        .setTimestamp();

    return embed;
}

/**
 * 相乗り希望ボタン（または満席時の非表示）を生成
 */
function buildCarpoolAnnouncementComponents(isFull, rideId) {
    const row = new ActionRowBuilder();

    if (!isFull) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`carpool:join:${rideId}`)
                .setLabel('相乗り希望')
                .setEmoji('🙋')
                .setStyle(ButtonStyle.Primary)
        );
    }

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`carpool:cancel:${rideId}:requester`)
            .setLabel('キャンセル')
            .setStyle(ButtonStyle.Danger)
    );

    return [row];
}

module.exports = {
    buildCarpoolAnnouncementEmbed,
    buildCarpoolAnnouncementComponents,
};
