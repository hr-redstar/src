const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const buildPanelEmbed = require('../../utils/embed/embedTemplate');
const buildPanelMessage = require('../../utils/embed/panelMessageTemplate');
const store = require('../../utils/ストレージ/ストア共通');

/**
 * ユーザー確認パネルのメッセージペイロードを生成
 * 
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @returns {Object} Discord message payload
 */
/**
 * ユーザー確認パネルのメッセージペイロードを生成
 * 
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').Client} client
 * @returns {Object} Discord message payload
 */
async function buildUserCheckPanelMessage(guild, client) {
    // データの取得
    const drivers = await store.loadDrivers(guild.id);
    const users = await store.loadUsers(guild.id);

    const driverContent = drivers.length > 0
        ? drivers.map(d => `• <@${d.userId}>　区域：${d.area || '未設定'}　停留場所：${d.stop || '未設定'}　ニックネーム：${d.nickname || '未設定'}　車種：${d.car || '未設定'}　乗車人数：${d.capacity || '未設定'}`).join('\n')
        : '登録なし';

    const userContent = users.length > 0
        ? users.map(u => `• <@${u.userId}> (${u.storeName || '未設定'})`).join('\n')
        : '登録なし';

    const botClient = client || guild.client;
    const embed = buildPanelEmbed({
        title: "ユーザー確認パネル",
        description: `現在の登録状況を確認・管理します。`,
        client: botClient
    });

    embed.addFields(
        { name: '送迎者一覧', value: driverContent, inline: false },
        { name: '利用者一覧', value: userContent, inline: false }
    );

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("ps:check")
            .setLabel("自分の登録情報を確認")
            .setStyle(ButtonStyle.Primary)
    );

    return buildPanelMessage({ embed, components: [row] });
}

const { sendOrUpdatePanel } = require('../共通/パネル送信');
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');

/**
 * ユーザー確認パネルを送信 or 更新する
 */
async function updateUserCheckPanel(guild, client) {
    const config = await loadConfig(guild.id);
    const panel = config.panels?.userCheckPanel;

    if (!panel || !panel.channelId) return;

    const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
    if (!channel) return;

    const newMessageId = await sendOrUpdatePanel({
        channel,
        messageId: panel.messageId,
        buildMessage: async () => buildUserCheckPanelMessage(guild, client),
        suppressFallback: true,
    });

    if (newMessageId && newMessageId !== panel.messageId) {
        config.panels.userCheckPanel.messageId = newMessageId;
        await saveConfig(guild.id, config);
    }
}

module.exports = {
    buildUserCheckPanelMessage,
    updateUserCheckPanel,
};
