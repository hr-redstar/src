// utils/配車/相乗りマネージャ.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const { loadConfig } = require('../設定/設定マネージャ');
const { formatDateShort } = require('../共通/日付フォーマット');

/**
 * 送迎者の最大乗車人数を取得
 */
async function getDriverCapacity(guildId, driverId) {
    // 待機中データに capacity があるはずだが、working になると消えている場合があるため
    // ActiveDispatch または ПользовательProfile から取得
    const { loadUser } = require('../usersStore');
    const user = await loadUser(guildId, driverId);
    return user?.capacity ? parseInt(user.capacity) : 4; // デフォルト4
}

/**
 * 残り乗車人数を計算
 */
async function calculateRemainingCapacity(guildId, rideData) {
    const driverId = rideData.driverId;
    const capacity = await getDriverCapacity(guildId, driverId);

    // 現在の乗員数 = 1 (依頼者) + 相乗り人数
    let currentCount = 1; // 依頼者本人
    if (rideData.guest) {
        // ゲストの場合も一旦1名として扱う（詳細人数不明なため）
    }

    if (rideData.carpoolUsers) {
        for (const user of rideData.carpoolUsers) {
            currentCount += (user.count || 1);
        }
    }

    return Math.max(0, capacity - currentCount);
}

/**
 * 相乗り募集メッセージを投稿/更新
 */
async function postCarpoolRecruitment(guild, rideData, client) {
    const config = await loadConfig(guild.id);
    const channelId = config.rideShareChannel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return;

    const remaining = await calculateRemainingCapacity(guild.id, rideData);
    if (remaining <= 0) {
        // 満員なら募集終了（メッセージ削除または更新）
        if (rideData.carpoolMessageId) {
            const msg = await channel.messages.fetch(rideData.carpoolMessageId).catch(() => null);
            if (msg) await msg.delete().catch(() => null);

            // データ更新
            rideData.carpoolMessageId = null;
            const activePath = `${paths.activeDispatchDir(guild.id)}/${rideData.rideId}.json`;
            await store.writeJson(activePath, rideData);
        }
        return;
    }

    // ルート表示の生成
    // 基本: 【送迎者現在地】→【利用者の目印】→【目的地】
    // 相乗りあり: 【送迎者現在地】→【相乗り希望者乗車場所】→【利用者の目印】→【目的地】
    let routeStr = `【${rideData.driverPlace || '現在地'}】`;

    // 相乗り経由地を追加
    if (rideData.carpoolUsers) {
        for (const user of rideData.carpoolUsers) {
            if (user.location) {
                routeStr += `→【${user.location}】`;
            } else {
                routeStr += `→【相乗り】`;
            }
        }
    }

    routeStr += `→【${rideData.mark || '不明'}】→【${rideData.destination}】`;

    const startedAt = new Date(rideData.startedAt);
    const timeStr = startedAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

    const embed = new EmbedBuilder()
        .setTitle('相乗りできます')
        .setDescription(
            `〇人まで（送迎者登録されている乗車人数-利用者人数）\n` +
            `※現在残り: **${remaining}名**\n\n` +
            `**${routeStr}**\n\n` +
            `送迎者現在地出発時刻： ${timeStr}\n\n` +
            `※相乗り希望後既に合流できない場合がある為、送迎可能か送迎者から連絡があります。`
        )
        .setColor(0x00FFFF) // Aqua
        .setTimestamp(startedAt);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`carpool:join:${rideData.rideId}`)
            .setLabel('相乗り希望')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🙋‍♂️')
    );

    let message;
    if (rideData.carpoolMessageId) {
        message = await channel.messages.fetch(rideData.carpoolMessageId).catch(() => null);
        if (message) {
            await message.edit({ embeds: [embed], components: [row] });
        }
    }

    if (!message) {
        message = await channel.send({ embeds: [embed], components: [row] });

        // メッセージID保存
        rideData.carpoolMessageId = message.id;
        const activePath = `${paths.activeDispatchDir(guild.id)}/${rideData.rideId}.json`;
        await store.writeJson(activePath, rideData);

        // グローバルログ用にも送信
        const { postGlobalLog } = require('../ログ/グローバルログ');
        await postGlobalLog({
            guild,
            content: `相乗り募集が開始されました！ [詳細はこちら](${message.url})`,
        }).catch(() => null);
    }
}

async function getDriverPlace(guildId, userId) {
    return '送迎中';
}

module.exports = {
    postCarpoolRecruitment,
    calculateRemainingCapacity
};
