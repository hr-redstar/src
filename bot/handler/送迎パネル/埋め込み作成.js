﻿// handler/送迎パネル/埋め込み作成.js

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const store = require('../../utils/ストレージ/ストア共通');
const paths = require('../../utils/ストレージ/ストレージパス');
const { getQueue } = require('../../utils/配車/待機列マネージャ');
const { loadConfig } = require('../../utils/設定/設定マネージャ');

/**
 * 送迎者パネルの埋め込みを生成
 */
function buildDriverPanelEmbed(guild, driverCount = 0, client) {
    const botClient = client || guild.client;
    return buildPanelEmbed({
        title: '送迎者パネル',
        description: `
送迎者の出勤・退勤・現在地の更新を行います。

現在の出勤中ドライバー: ${driverCount} 名
    `,
        client: botClient,
    });
}

const { addInquiryButtonToComponents } = require('../共通/InquiryPanel');

/**
 * 送迎者パネルのボタンを生成
 */
function buildDriverPanelComponents() {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('driver|on')
            .setLabel('出勤')
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
    const components = [row];
    return addInquiryButtonToComponents(components);
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
async function buildRideListPanelMessage(guild, client) {
    const queue = await getQueue(guild.id);
    const config = await loadConfig(guild.id).catch(() => ({}));
    const userRanks = config.ranks?.userRanks || {};

    // 待機中の利用者リスト読み込み
    const userWaitDir = paths.waitingUsersDir(guild.id);
    const userWaitFiles = await store.listKeys(userWaitDir).catch(() => []);
    const waitingUsers = [];
    for (const f of userWaitFiles) {
        if (!f.endsWith('.json')) continue;
        const data = await store.readJson(f).catch(() => null);
        if (data) waitingUsers.push(data);
    }
    // timestamp 順にソート (古い順)
    waitingUsers.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    const activeDispatchDir = paths.activeDispatchDir(guild.id);
    const activeFiles = await store.listKeys(activeDispatchDir).catch(() => []);

    // ファイルの中身を読み込んでIDを取得
    const activeDispatches = await Promise.all(
        activeFiles
            .filter((f) => f.endsWith('.json'))
            .map((f) => store.readJson(f).catch(() => null))
    );
    const validDispatches = activeDispatches.filter((d) => d);

    const allActiveDriverIds = validDispatches.map((d) => d.driverId).filter(Boolean);
    const activeDriverIds = [...new Set(allActiveDriverIds)];
    const activeUserIds = [];
    validDispatches.forEach((d) => {
        if (d.userId) activeUserIds.push(d.userId);
        if (Array.isArray(d.carpoolUsers)) {
            d.carpoolUsers.forEach((u) => {
                if (u.userId) activeUserIds.push(u.userId);
            });
        }
    });
    const uniqueActiveUserIds = [...new Set(activeUserIds)];

    // 待機中の送迎車リスト (FIFO順)
    const waitingDriverLines = [];
    if (queue.length === 0) {
        waitingDriverLines.push('待機中の送迎車はいません。');
    } else {
        waitingDriverLines.push('`順位｜待機開始｜名前｜現在地｜車種/カラー/ナンバー`');
        queue.forEach((d, idx) => {
            const time = d.timestamp ? new Date(d.timestamp).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '--:--';
            const car = d.carInfo || d.car || '-';
            const place = d.stopPlace || d.place || '不明';
            const rank = userRanks[d.userId] ? `[${userRanks[d.userId]}] ` : '';
            waitingDriverLines.push(`第${idx + 1}位｜${time}｜${rank}<@${d.userId}>｜${place}｜${car}`);
        });
    }

    // 送迎中リスト
    const onRouteLines = [];
    if (validDispatches.length === 0) {
        onRouteLines.push('現在送迎中の車両はありません。');
    } else {
        validDispatches.forEach((d) => {
            const dest = d.destination || d.direction || '詳細不明';
            const rank = userRanks[d.driverId] ? `[${userRanks[d.driverId]}] ` : '';
            onRouteLines.push(`${rank}<@${d.driverId}>　**行先**：${dest}`);
        });
    }

    // 待機中の利用者リスト
    const waitingUserLines = [];
    if (waitingUsers.length === 0) {
        waitingUserLines.push('待機中のユーザーはいません。');
    } else {
        waitingUsers.forEach((u) => {
            const loc = u.destination || u.direction || '詳細不明';
            const rank = userRanks[u.userId] ? `[${userRanks[u.userId]}] ` : '';
            waitingUserLines.push(`${rank}<@${u.userId}> (${loc})`);
        });
    }

    // 利用者リスト (乗車中)
    const ridingUserLines = uniqueActiveUserIds.map((id) => `<@${id}>`);
    const ridingUserText = ridingUserLines.length > 0 ? ridingUserLines.join(', ') : 'なし';

    const embed = buildPanelEmbed({
        title: '送迎一覧パネル',
        description: '現在の待機状況と送迎中のステータスを表示します。',
        client,
        fields: [
            { name: '🚗 待機中の送迎車（FIFO順）', value: waitingDriverLines.join('\n'), inline: false },
            { name: '👤 待機中', value: waitingUserLines.join('\n'), inline: false },
            { name: '🚕 送迎中', value: onRouteLines.join('\n'), inline: false },
        ],
        color: 0x3498db,
    });

    const rowHistory = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('adm|history|sub=recent')
            .setLabel('配車履歴(最新10件)')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('adm|history|sub=detail')
            .setLabel('送迎履歴詳しく')
            .setStyle(ButtonStyle.Primary)
    );

    const rowAdmin = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('adm|ride|sub=force_end_menu')
            .setLabel('送迎強制終了')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('dispatch|forceOff|sub=menu')
            .setLabel('🛑 ドライバー強制退勤')
            .setStyle(ButtonStyle.Danger)
    );

    return buildPanelMessage({ embed, components: [rowHistory, rowAdmin] });
}

module.exports = {
    buildDriverPanelEmbed,
    buildDriverPanelComponents,
    buildDriverPanelMessage,
    buildRideListPanelMessage,
};
