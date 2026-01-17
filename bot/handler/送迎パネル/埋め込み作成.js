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
 */
async function buildRideListPanelMessage(guild, client) {
    const guildId = guild.id;
    const store = require('../../utils/ストレージ/ストア共通');
    const paths = require('../../utils/ストレージ/ストレージパス');

    const botClient = client || guild.client;
    const embed = buildPanelEmbed({
        title: '送迎一覧パネル',
        description: '現在の待機状況と送迎中のステータスを表示します。',
        client: botClient,
    });

    // 1. 待機中の送迎者の取得 (FIFO順)
    const driverWaitingDir = paths.waitingDriversDir(guildId);
    let driverWaitingList = '現在待機中の送迎車はありません。';
    try {
        const driverFiles = await store.listKeys(driverWaitingDir).catch(() => []);
        const jsonFiles = driverFiles.filter((f) => f.endsWith('.json'));

        if (jsonFiles.length > 0) {
            const drivers = [];
            for (const fileKey of jsonFiles) {
                const data = await store.readJson(fileKey).catch(() => null);
                if (data) drivers.push(data);
            }
            // タイムスタンプの古い順（FIFO）
            drivers.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            if (drivers.length > 0) {
                const lines = drivers.map((d, i) => {
                    const time = new Date(d.timestamp).toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                    });
                    return `第${i + 1}位｜${time}｜<@${d.userId}>｜${d.stopPlace || '不明'}｜${d.carInfo || '不明'}`;
                });
                driverWaitingList = lines.join('\n');
            }
        }
    } catch (e) { }

    // 2. 待機中の取得 (利用者)
    const userWaitingDir = paths.waitingUsersDir(guildId);
    let waitingList = '待機中のユーザーはいません。';
    try {
        const waitingFiles = await store.listKeys(userWaitingDir).catch(() => []);
        const filteredFiles = waitingFiles.filter((f) => f.endsWith('.json'));
        if (filteredFiles.length > 0) {
            const users = [];
            for (const fileKey of filteredFiles) {
                const data = await store.readJson(fileKey).catch(() => null);
                if (data) users.push(data);
            }
            users.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const lines = users.map((data) => {
                const time = new Date(data.timestamp).toLocaleTimeString('ja-JP', {
                    hour: '2-digit',
                    minute: '2-digit',
                });
                return `${time}｜<@${data.userId}>${data.guest ? ' (ゲスト)' : ''}｜${data.from}`;
            });
            if (lines.length > 0) waitingList = lines.join('\n');
        }
    } catch (e) { }

    // 3. 送迎中（配車中）の取得
    const ridingDir = paths.activeDispatchDir(guildId);
    let ridingList = '現在送迎中の車両はありません。';
    try {
        const ridingFiles = await store.listKeys(ridingDir).catch(() => []);
        const filteredFiles = ridingFiles.filter((f) => f.endsWith('.json'));
        if (filteredFiles.length > 0) {
            const lines = [];
            for (const fileKey of filteredFiles) {
                const data = await store.readJson(fileKey).catch(() => null);
                if (data) {
                    const status = data.status === 'departing' ? '実車中' : '配車済';
                    const carpoolCount = data.carpoolUsers?.length || 0;
                    const carpoolText = carpoolCount > 0 ? ` (+相乗り${carpoolCount}組)` : '';
                    lines.push(
                        `【${status}】<@${data.driverId}> ➔ <@${data.passengerId}> (${data.direction})${carpoolText}`
                    );
                }
            }
            if (lines.length > 0) ridingList = lines.join('\n');
        }
    } catch (e) { }

    embed
        .setDescription(
            `
現在の待機状況と送迎中のステータスを表示します。

🚗 **待機中の送迎車（FIFO順）**
順位｜待機開始｜名前｜待機場所｜車種
${driverWaitingList}

👤 **待機中 (利用者)**
${waitingList}

🚕 **送迎中**
${ridingList}
    `
        )
        .setFooter({ text: `送迎bot｜${new Date().toLocaleString('ja-JP')}` });

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
