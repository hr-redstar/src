// handler/自動設定/setupLogic.js
const { loadConfig, saveConfig } = require('../../utils/設定/設定マネージャ');
const {
    ensureCategory,
    ensureTextChannel,
    getAdminOnlyPermissions,
    getReadOnlyPermissions
} = require('./setupUtils');
const { installPanel } = require('../パネル設置/共通/設置テンプレ');

/**
 * 全カテゴリー・全チャンネル一括セットアップ
 */
async function setupAll(interaction) {
    const results = [];
    results.push(await setupEntryCategory(interaction));
    results.push(await setupAdminCategory(interaction));
    results.push(await setupDriverCategory(interaction));
    results.push(await setupUserCategory(interaction));
    results.push(await setupPrivateVcCategory(interaction));
    results.push(await setupUserMemoCategory(interaction));
    return results;
}

/**
 * 入口・登録カテゴリー
 */
async function setupEntryCategory(interaction) {
    const guild = interaction.guild;
    const categoryResult = await ensureCategory(guild, '入口・登録カテゴリー');
    const parent = categoryResult.channel;

    // 1. 使い方 (案内パネル)
    const guideRes = await ensureTextChannel(guild, '┣🔰使い方', parent);
    if (guideRes.status === 'created') {
        const { buildGuidePanelMessage } = require('./guidePanelBuilder');
        await installPanel({
            interaction,
            panelKey: 'guide',
            panelName: '案内パネル',
            channel: guideRes.channel,
            buildMessage: async () => buildGuidePanelMessage(guild),
        });
    }

    // 2. 送迎者登録パネル
    const driverRegRes = await ensureTextChannel(guild, '┣🚙送迎者登録パネル', parent);
    if (driverRegRes.status === 'created') {
        const { buildDriverRegPanelMessage } = require('../登録処理/送迎者登録');
        await installPanel({
            interaction,
            panelKey: 'driverRegister',
            panelName: '送迎者登録パネル',
            channel: driverRegRes.channel,
            buildMessage: async () => buildDriverRegPanelMessage(guild, guild.client),
        });
    }

    // 3. 利用者登録パネル
    const userRegRes = await ensureTextChannel(guild, '┗利用者登録パネル', parent);
    if (userRegRes.status === 'created') {
        const { buildUserRegPanelMessage } = require('../登録処理/利用者登録');
        await installPanel({
            interaction,
            panelKey: 'userRegister',
            panelName: '利用者登録パネル',
            channel: userRegRes.channel,
            buildMessage: async () => buildUserRegPanelMessage(guild, guild.client),
        });
    }

    return { name: '入口・登録カテゴリー', status: categoryResult.status };
}

/**
 * 運営者カテゴリー
 */
async function setupAdminCategory(interaction) {
    const guild = interaction.guild;
    const cfg = await loadConfig(guild.id);
    const adminPermissions = getAdminOnlyPermissions(guild, cfg.operatorRoleId);

    const categoryResult = await ensureCategory(guild, '運営者用カテゴリー', adminPermissions);
    const parent = categoryResult.channel;

    // 各種チャンネル作成とパネル配置
    const configs = [
        { name: '管理者パネル', key: 'admin', panelName: '管理者パネル', builder: require('../管理者パネル/メイン').buildAdminPanelMessage },
        { name: '運営者パネル', key: 'operatorPanel', panelName: '運営者パネル', builder: require('../運営者パネル/メイン').buildOperatorPanelMessage },
        { name: '送迎者一覧パネル', key: 'rideListPanel', panelName: '送迎一覧パネル', builder: require('../送迎パネル/埋め込み作成').buildRideListPanelMessage },
        { name: '情報確認パネル', key: 'userCheckPanel', panelName: 'ユーザー確認パネル', builder: require('../登録処理/ユーザー確認パネル').buildUserCheckPanelMessage },
        { name: 'ランクパネル', key: 'ratingRank', panelName: '口コミランクパネル', builder: require('../管理者パネル/口コミランクパネル構築').buildRatingRankPanelMessage },
    ];

    for (const item of configs) {
        const chRes = await ensureTextChannel(guild, item.name, parent, adminPermissions);
        if (chRes.status === 'created' || !cfg.panels?.[item.key]?.messageId) {
            await installPanel({
                interaction,
                panelKey: item.key,
                panelName: item.panelName,
                channel: chRes.channel,
                buildMessage: async () => {
                    if (item.key === 'admin' || item.key === 'operatorPanel') {
                        return item.builder(guild, cfg, guild.client);
                    }
                    if (item.key === 'ratingRank') {
                        return item.builder(guild, cfg);
                    }
                    return item.builder(guild, guild.client);
                },
            });
        }
        // 特殊：運営者ログの設定
        if (item.key === 'operatorPanel') {
            // 別途「運営者ログ」チャンネルも作るが、パネルは置かない
            const logChRes = await ensureTextChannel(guild, '運営者ログ', parent, adminPermissions);
            cfg.logs ??= {};
            cfg.logs.operatorChannel = logChRes.channel.id;
        }
    }

    await saveConfig(guild.id, cfg);
    return { name: '運営者用カテゴリー', status: categoryResult.status };
}

/**
 * 送迎者カテゴリー
 */
async function setupDriverCategory(interaction) {
    const guild = interaction.guild;
    const categoryResult = await ensureCategory(guild, '送迎者カテゴリー');
    const parent = categoryResult.channel;

    const chRes = await ensureTextChannel(guild, '送迎者パネル', parent);
    if (chRes.status === 'created') {
        const { buildDriverPanelMessage } = require('../送迎パネル/埋め込み作成');
        await installPanel({
            interaction,
            panelKey: 'driverPanel',
            panelName: '送迎者パネル',
            channel: chRes.channel,
            buildMessage: async () => buildDriverPanelMessage(guild, 0, guild.client),
        });
    }

    return { name: '送迎者カテゴリー', status: categoryResult.status };
}

/**
 * 利用者カテゴリー
 */
async function setupUserCategory(interaction) {
    const guild = interaction.guild;
    const categoryResult = await ensureCategory(guild, '利用者カテゴリー');
    const parent = categoryResult.channel;

    // 1. 利用者パネル
    const panelRes = await ensureTextChannel(guild, '利用者パネル', parent);
    if (panelRes.status === 'created') {
        const { buildUserPanelMessage } = require('../利用者パネル/埋め込み作成');
        await installPanel({
            interaction,
            panelKey: 'userPanel',
            panelName: '利用者パネル',
            channel: panelRes.channel,
            buildMessage: async () => buildUserPanelMessage(guild, 0, guild.client),
        });
    }

    // 2. 相乗りお知らせ (閲覧専用)
    const cfg = await loadConfig(guild.id);
    const readOnly = getReadOnlyPermissions(guild, cfg.roles?.users?.[0]);
    const notifyRes = await ensureTextChannel(guild, '相乗りお知らせ', parent, readOnly);

    cfg.rideShareChannel = notifyRes.channel.id;
    await saveConfig(guild.id, cfg);

    return { name: '利用者カテゴリー', status: categoryResult.status };
}

/**
 * プライベートVCカテゴリー
 */
async function setupPrivateVcCategory(interaction) {
    const guild = interaction.guild;
    const categoryResult = await ensureCategory(guild, 'プライベートVCカテゴリー');

    const cfg = await loadConfig(guild.id);
    cfg.categories ??= {};
    cfg.categories.privateVc = categoryResult.channel.id;

    // 使い方チャンネル
    const guideRes = await ensureTextChannel(guild, '📝プライベートVCの使い方', categoryResult.channel);

    await saveConfig(guild.id, cfg);
    return { name: 'プライベートVCカテゴリー', status: categoryResult.status };
}

/**
 * ユーザーメモカテゴリー
 */
async function setupUserMemoCategory(interaction) {
    const guild = interaction.guild;
    const categoryResult = await ensureCategory(guild, 'ユーザーメモカテゴリー');

    const cfg = await loadConfig(guild.id);
    cfg.categories ??= {};
    cfg.categories.userMemo = categoryResult.channel.id;

    // 使い方チャンネル
    const guideRes = await ensureTextChannel(guild, '📝ユーザーメモの使い方', categoryResult.channel);

    await saveConfig(guild.id, cfg);
    return { name: 'ユーザーメモカテゴリー', status: categoryResult.status };
}

module.exports = {
    setupAll,
    setupEntryCategory,
    setupAdminCategory,
    setupDriverCategory,
    setupUserCategory,
    setupPrivateVcCategory,
    setupUserMemoCategory,
};
