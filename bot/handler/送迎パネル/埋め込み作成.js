// handler/送迎パネル/埋め込み作成.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');

/**
 * 送迎者パネルの埋め込みを生成
 */
function buildDriverPanelEmbed(guild, driverCount = 0, client) {
    const botClient = client || guild.client;
    return buildPanelEmbed({
        title: '送迎者パネル',
        description: `
送迎者の出勤・退勤・現在地の更新を行います。

現在の出勤中ドライバー: **${driverCount}** 名
    `,
        client: botClient,
    });
}

/**
 * 送迎者パネルのボタンを生成
 */
function buildDriverPanelComponents() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('driver|on')
            .setLabel('今から行けます')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('driver|off')
            .setLabel('退勤します')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('driver|location')
            .setLabel('現在地更新')
            .setStyle(ButtonStyle.Primary)
    );
    return [row];
}

/**
 * 送迎者パネルのメッセージペイロードを生成
 */
function buildDriverPanelMessage(guild, activeCount = 0, client) {
    const botClient = client || guild.client;
    const embed = buildDriverPanelEmbed(guild, activeCount, botClient);
    const components = buildDriverPanelComponents();
    return buildPanelMessage({ embed, components });
}

/**
 * 送迎一覧パネルのメッセージペイロードを生成
 * (v1.6.5: Context-Resilient & Self-Sufficient)
 */
async function buildRideListPanelMessage(guild, client, context = {}) {
    const guildId = guild.id;
    const store = require('../../utils/ストレージ/ストア共通');
    const paths = require('../../utils/ストレージ/ストレージパス');
    const { getQueue } = require('../../utils/配車/待機列マネージャ');

    const botClient = client || guild.client;

    // 1. 待機中の送迎車
    let driverWaitingList = context.driverWaitingList;
    if (driverWaitingList === undefined) {
        const queue = await getQueue(guildId).catch(() => []);
        driverWaitingList = queue.length > 0
            ? queue.map((d, i) => `${i + 1}. <@${d.userId}>`).join('\n')
            : '現在待機中の送迎車はありません。';
    }

    // 2. 待機中の利用者 (未マッチングの依頼)
    let waitingList = context.waitingList;
    if (waitingList === undefined) {
        const userKeys = await store.listKeys(paths.waitingUsersDir(guildId)).catch(() => []);
        let userListStrings = [];
        for (const key of userKeys) {
            if (!key.endsWith('.json')) continue;
            const data = await store.readJson(key).catch(() => null);
            if (data && data.userId) {
                userListStrings.push(`<@${data.userId}> (${data.direction || '不明'})`);
            }
        }
        waitingList = userListStrings.length > 0
            ? userListStrings.join('\n')
            : '待機中のユーザーはいません。';
    }

    // 3. 送迎中の車両 (配車中一覧)
    let ridingList = context.ridingList;
    if (ridingList === undefined) {
        const activeKeys = await store.listKeys(paths.activeDispatchDir(guildId)).catch(() => []);
        let activeListStrings = [];
        for (const key of activeKeys) {
            if (!key.endsWith('.json')) continue;
            const data = await store.readJson(key).catch(() => null);
            if (data && data.driverId && data.passengerId) {
                activeListStrings.push(`🚖 <@${data.driverId}> ➡️ <@${data.passengerId}> (${data.direction || '不明'})`);
            }
        }
        ridingList = activeListStrings.length > 0
            ? activeListStrings.join('\n')
            : '現在送迎中の車両はありません。';
    }

    const embed = buildPanelEmbed({
        title: '📋 送迎・待機状況 一覧',
        description: '現在の送迎車の待機状況と、進行中の送迎ステータスをリアルタイムで表示します。',
        color: 0x3498db,
        client: botClient,
        fields: [
            {
                name: '🚗 待機中の送迎車',
                value: driverWaitingList.includes('<@')
                    ? driverWaitingList
                    : `\`${driverWaitingList}\``,
                inline: false
            },
            {
                name: '👤 待機中の利用者',
                value: waitingList.includes('<@')
                    ? waitingList
                    : `\`${waitingList}\``,
                inline: false
            },
            {
                name: '🚕 送迎中の車両',
                value: ridingList.includes('<@')
                    ? ridingList
                    : `\`${ridingList}\``,
                inline: false
            }
        ]
    });

    embed.setFooter({ text: `最終更新：${new Date().toLocaleString('ja-JP')} ｜ Professional Edition` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('adm|history|sub=recent')
            .setLabel('送迎履歴直近10件')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('adm|history|sub=detail')
            .setLabel('送迎履歴詳しく')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('adm|ride|sub=force_end_menu')
            .setLabel('送迎強制終了')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('dispatch|forceOff|sub=menu')
            .setLabel('🛑 ドライバー強制退勤')
            .setStyle(ButtonStyle.Danger)
    );

    return buildPanelMessage({ embed, components: [row] });
}

module.exports = {
    buildDriverPanelEmbed,
    buildDriverPanelComponents,
    buildDriverPanelMessage,
    buildRideListPanelMessage,
};
