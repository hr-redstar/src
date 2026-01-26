// src/bot/handler/相乗り/carpoolNotifyDriver.js
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * ドライバーへ相乗り希望のDMリクエストを送信する (共通ロジック)
 */
async function sendCarpoolRequestToDriver({ guild, client, rideId, direction, location, userId, count }) {
    try {
        // 配車データの読み込み
        const activePath = `${paths.activeDispatchDir(guild.id)}/${rideId}.json`;
        const rideData = await store.readJson(activePath).catch(() => null);

        if (!rideData) {
            throw new Error('送迎データが見つかりませんでした。');
        }

        // 保留中のリクエストとしてデータを保存 (ID文字数制限対策)
        rideData.pendingCarpoolRequests = rideData.pendingCarpoolRequests || {};
        rideData.pendingCarpoolRequests[userId] = {
            direction,
            location,
            count,
            timestamp: new Date().toISOString()
        };
        await store.writeJson(activePath, rideData);

        // 利用者のプロファイルを読み込む
        const { loadUser } = require('../../utils/usersStore');
        const profile = await loadUser(guild.id, userId).catch(() => null);
        const storeName = profile?.storeName || profile?.name || '不明';
        const address = profile?.address || '不明';
        const markText = profile?.mark || profile?.landmark || 'なし';

        // 走行情報の構築
        const rideTime = rideData.matchTime || (rideData.timestamp ? new Date(rideData.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--');
        const monthDay = rideData.timestamp ? `${new Date(rideData.timestamp).getMonth() + 1}/${new Date(rideData.timestamp).getDate()}` : '';
        const currentRoute = `【${rideData.driverPlace || '現在地'}】→【${rideData.mark || '不明'}】→【${rideData.destination || '方面'}】`;

        const embed = buildPanelEmbed({
            title: '🤝 相乗り希望',
            description: `${monthDay} ${rideTime}~--:-- ${currentRoute} の送迎に相乗り希望者がいます。`,
            fields: [
                { name: '👥 人数', value: `${count}名`, inline: true },
                { name: '👤 希望者', value: `${storeName}\n<@${userId}>`, inline: true },
                { name: '📍 相乗り者合流場所', value: `${address} / ${markText}`, inline: false },
                { name: '🗺️ 方面', value: direction, inline: true },
                { name: '🔊 ボイスチャンネル', value: rideData.vcId ? `[プライベートVCはこちら](https://discord.com/channels/${guild.id}/${rideData.vcId})` : '未作成', inline: false }
            ],
            type: 'info',
            client
        });

        const gidSuffix = rideId.split('_').length < 3 ? `&gid=${guild.id}` : '';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`carpool|join|sub=ss&r=${rideId}&u=${userId}${gidSuffix}`)
                .setLabel('許可')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`carpool|reject|r=${rideId}&u=${userId}${gidSuffix}`)
                .setLabel('却下')
                .setStyle(ButtonStyle.Danger)
        );

        const driverId = rideData.driverId;
        const driverMember = await guild.members.fetch(driverId).catch(() => null);
        if (!driverMember) {
            throw new Error(`ドライバー(<@${driverId}>)が見つからなかったため、リクエストを送れませんでした。`);
        }

        await driverMember.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('相乗り依頼DM送信エラー:', error);
        throw error;
    }
}

module.exports = { sendCarpoolRequestToDriver };
