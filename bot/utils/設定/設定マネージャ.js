const store = require("../ストレージ/ストア共通");
const paths = require("../ストレージ/ストレージパス");

/**
 * 設定オブジェクトを正規化し、ユーザー指定の最終スキーマに合わせる
 */
function normalizeConfig(cfg = {}) {
    const base = {
        panels: {
            panelSetup: { messageId: null, channelId: null },
            admin: { messageId: null, channelId: null },
            guide: { messageId: null, channelId: null },
            driverRegister: { messageId: null, channelId: null },
            userRegister: { messageId: null, channelId: null },
            userPanel: { messageId: null, channelId: null },
            driverPanel: { messageId: null, channelId: null },
            userCheckPanel: { messageId: null, channelId: null },
            rideList: { messageId: null, channelId: null },
            ratingRank: { messageId: null, channelId: null },
            carpoolPanel: { messageId: null, channelId: null },
            globalLog: { messageId: null, channelId: null },
            operatorLog: { messageId: null, channelId: null },
        },
        roles: {
            drivers: [],
            driverMention: null,
            users: [],
            userMention: null,
            priorityDrivers: [],
            priorityMention: null,
        },
        categories: {
            privateVc: null,
            userMemo: null,
        },
        logs: {
            globalChannel: null,
            operatorChannel: null,
            adminLogThread: null,
            adminLogThreadIndex: 1,
            guideChannel: null,
        },
        rideShareChannel: null,
    };

    // 1. 各セクションの結合
    const merged = {
        panels: { ...base.panels, ...(cfg.panels || {}) },
        roles: { ...base.roles, ...(cfg.roles || {}) },
        categories: { ...base.categories, ...(cfg.categories || {}) },
        logs: { ...base.logs, ...(cfg.logs || {}) },
        rideShareChannel: cfg.rideShareChannel || base.rideShareChannel,
    };

    // 2. 旧形式（移行用）からのデータサルベージ
    // 既存のコードが破壊されないよう、読み込み時に自動移行を行う

    // ロール移行：単体キーから配列へ
    if (cfg.roles?.driver && !merged.roles.drivers.includes(cfg.roles.driver)) {
        merged.roles.drivers.push(cfg.roles.driver);
    }
    if (cfg.roles?.user && !merged.roles.users.includes(cfg.roles.user)) {
        merged.roles.users.push(cfg.roles.user);
    }

    // チャンネル・スレッド・ログ移行：channels / threads から logs / rideShareChannel へ
    if (cfg.channels?.rideShare) merged.rideShareChannel = cfg.channels.rideShare;
    if (cfg.channels?.operatorLog) merged.logs.operatorChannel = cfg.channels.operatorLog;
    if (cfg.channels?.globalLog) merged.logs.globalChannel = cfg.channels.globalLog;

    if (cfg.threads?.adminLog) merged.logs.adminLogThread = cfg.threads.adminLog;
    if (cfg.threads?.adminLogIndex) merged.logs.adminLogThreadIndex = cfg.threads.adminLogIndex;

    // パネル設定(panels) からの同期 (設置パネルで保存された場合用)
    if (merged.panels.carpoolPanel?.channelId) merged.rideShareChannel = merged.panels.carpoolPanel.channelId;
    if (merged.panels.operatorLog?.channelId) merged.logs.operatorChannel = merged.panels.operatorLog.channelId;
    if (merged.panels.globalLog?.channelId) merged.logs.globalChannel = merged.panels.globalLog.channelId;

    // パネル移行 (panelMessages -> panels)
    const mapPanel = (newKey, oldKey) => {
        if (cfg.panelMessages?.[oldKey]) {
            // 新しい場所が空なら移行
            if (!merged.panels[newKey].messageId) {
                merged.panels[newKey] = {
                    messageId: cfg.panelMessages[oldKey].messageId || null,
                    channelId: cfg.panelMessages[oldKey].channelId || null
                };
            }
        }
    };

    mapPanel('admin', 'adminPanel');
    mapPanel('driverPanel', 'driverPanel');
    mapPanel('driverRegister', 'driverRegPanel');
    mapPanel('userRegister', 'userRegPanel');
    mapPanel('panelSetup', 'panelSetup');
    mapPanel('guide', 'guidePanel');
    // 不足していたパネルの追加
    mapPanel('userPanel', 'userPanel');
    mapPanel('userCheckPanel', 'userCheckPanel');
    mapPanel('rideList', 'rideList');
    mapPanel('ratingRank', 'ratingRank');

    return merged;
}

/**
 * ギルドの設定を読み込む
 */
async function loadConfig(guildId) {
    const path = paths.configJson(guildId);
    const raw = await store.readJson(path, {});
    const normalized = normalizeConfig(raw);

    // 読み込み時に構造が変わっていた場合（移行が発生した場合）は自動保存
    if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
        console.log(`[Config] Auto-migrating config for guild: ${guildId}`);
        await store.writeJson(path, normalized);
    }

    return normalized;
}

/**
 * ギルドの設定を保存する
 */
async function saveConfig(guildId, config) {
    const path = paths.configJson(guildId);
    // 保存前に正規化してゴミを消す
    await store.writeJson(path, normalizeConfig(config));
}

module.exports = {
    normalizeConfig,
    loadConfig,
    saveConfig,
};
