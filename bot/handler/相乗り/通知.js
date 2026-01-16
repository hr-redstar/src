const { EmbedBuilder } = require('discord.js');
const { loadConfig } = require('../設定/設定マネージャ');
const store = require('../../utils/ストレージ/ストア共通');
const { buildCarpoolAnnouncementEmbed, buildCarpoolAnnouncementComponents } = require('./埋め込み作成');
const { postGlobalLog } = require('../utils/ログ/グローバルログ');

/**
 * 相乗りチャンネルへ告知を投稿し、グローバルログへも通知する
 */
async function postCarpoolNotice({
    guild,
    rideId,
    driverLocation,
    userLandmark,
    destination,
    capacity,
    currentUsers,
    departureTime,
    driverUser,
}) {
    const config = await loadConfig(guild.id);
    const channelId = config.rideShareChannel;
    if (!channelId) return null;

    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return null;

    const embed = buildCarpoolAnnouncementEmbed({
        driverLocation,
        userLandmark,
        destination,
        capacity,
        currentUsers,
        departureTime,
        botName: guild.client.user.username,
        isFull: capacity - currentUsers <= 0,
    });

    const components = buildCarpoolAnnouncementComponents(capacity - currentUsers <= 0, rideId);

    const message = await channel.send({
        embeds: [embed],
        components,
    });

    // 状態の保存
    const rideData = {
        rideId,
        guildId: guild.id,
        channelId,
        messageId: message.id,
        driverId: driverUser.id,
        driverLocation,
        userLandmark,
        destination,
        capacity,
        currentUsers,
        carpoolUsers: [], // { userId, pickup, count }
        departureTime,
        status: 'active',
    };
    const paths = require('../../utils/ストレージ/ストレージパス');
    await store.writeJson(`${paths.carpoolDir(guild.id)}/${rideId}.json`, rideData);

    // グローバルログへ通知
    await postGlobalLog({
        guild,
        embeds: [
            new EmbedBuilder()
                .setTitle('🚗 相乗り受付開始')
                .setDescription(
                    [
                        `👤 送迎者：${driverUser}`,
                        '',
                        `🛣 ルート`,
                        `【${driverLocation}】→【${userLandmark}】→【${destination}】`,
                        '',
                        `🪑 残り人数：${capacity - currentUsers}`,
                        '',
                        `🔗 相乗り案内メッセージ`,
                        message.url,
                    ].join('\n')
                )
                .setFooter({ text: guild.client.user.username })
                .setTimestamp()
        ],
    });

    return message.id;
}

module.exports = { postCarpoolNotice };
