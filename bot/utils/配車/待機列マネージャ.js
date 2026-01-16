const store = require("../ストレージ/ストア共通");
const paths = require("../ストレージ/ストレージパス");

/**
 * 待機列の全ドライバーを取得（FIFOソート済み）
 */
async function getQueue(guildId) {
    const root = paths.waitingDriversDir(guildId);
    const files = await store.listKeys(root).catch(() => []);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) return [];

    const drivers = [];
    for (const fileKey of jsonFiles) {
        const data = await store.readJson(fileKey).catch(() => null);
        if (data) {
            // userIdが欠落している場合はファイル名から補完
            if (!data.userId) {
                const pathParts = fileKey.split('/');
                const fileName = pathParts[pathParts.length - 1];
                data.userId = fileName.replace('.json', '');
            }
            drivers.push(data);
        }
    }

    // タイムスタンプの古い順（FIFO）にソート
    drivers.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return drivers;
}

/**
 * 待機列から次のドライバーを取得（削除はしない）
 */
async function peekNextDriver(guildId) {
    const queue = await getQueue(guildId);
    return queue.length > 0 ? queue[0] : null;
}

/**
 * 待機列から次のドライバーを取り出す（配車用、削除を伴う）
 * 優先ロール（config.roles.priorityDrivers）を持つドライバーを優先的に、
 * かつ待機時間が長い順（FIFO）で抽出する。
 */
async function popNextDriver(guildId) {
    const { loadConfig } = require("../設定/設定マネージャ");
    const config = await loadConfig(guildId);
    const priorityRoleIds = config.roles?.priorityDrivers || [];

    const queue = await getQueue(guildId);
    if (queue.length === 0) return null;

    let nextDriver = null;

    // 優先ロールを持つドライバーの探索
    if (priorityRoleIds.length > 0) {
        // 全ドライバーのメンバー情報を取得orキャッシュしてロール確認
        // ここでは queue データにロール情報が含まれていない前提で、GuildMember から確認
        // ※ 本来は queue 保存時に優先フラグを立てるのが効率的だが、
        // 現状のファイルベースではリアルタイム権限確認が必要
        const client = require("../../../index").client; // 暫定的にグローバル参照
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
            for (const driverData of queue) {
                const member = await guild.members.fetch(driverData.userId).catch(() => null);
                if (member && member.roles.cache.some(r => priorityRoleIds.includes(r.id))) {
                    nextDriver = driverData;
                    break; // FIFOなので最初に見つかった優先者が最古
                }
            }
        }
    }

    // 優先者がいなければ通常通り先頭
    if (!nextDriver) {
        nextDriver = queue[0];
    }

    const root = paths.waitingDriversDir(guildId);
    const waitPath = `${root}/${nextDriver.userId}.json`;

    await store.deleteFile(waitPath).catch(() => null);
    await updateDutyList(guildId);
    return nextDriver;
}

/**
 * ドライバーを待機列に追加・最後尾へ戻す
 */
async function pushToQueue(guildId, userId, additionalData = {}) {
    const root = paths.waitingDriversDir(guildId);
    const waitPath = `${root}/${userId}.json`;

    // 既存データの読み込みを試みる
    const existing = await store.readJson(waitPath).catch(() => ({}));

    const entry = {
        ...existing,
        ...additionalData,
        userId,
        timestamp: new Date().toISOString() // タイムスタンプ更新。これで最後尾になる
    };

    await store.writeJson(waitPath, entry);
    await updateDutyList(guildId);
    return entry;
}

/**
 * 指定ユーザーの待機順位を取得 (1-indexed)
 */
async function getPosition(guildId, userId) {
    const queue = await getQueue(guildId);
    const index = queue.findIndex(d => d.userId === userId);
    return index === -1 ? null : index + 1;
}

/**
 * 指定ドライバーの送迎件数をインクリメント
 */
async function incrementRideCount(guildId, userId) {
    const root = paths.waitingDriversDir(guildId);
    const waitPath = `${root}/${userId}.json`;
    const existing = await store.readJson(waitPath).catch(() => null);

    if (existing) {
        existing.rideCount = (existing.rideCount || 0) + 1;
        await store.writeJson(waitPath, existing);
    }
}

/**
 * 待機列から削除（退勤時など）
 * @returns {Object|null} 削除されたデータ（出勤時刻や送迎数などを含む）
 */
async function removeFromQueue(guildId, userId) {
    const root = paths.waitingDriversDir(guildId);
    const waitPath = `${root}/${userId}.json`;
    const data = await store.readJson(waitPath).catch(() => null);
    await store.deleteFile(waitPath).catch(() => null);
    await updateDutyList(guildId);
    return data;
}

/**
 * 送迎中一覧.json を更新する
 */
async function updateDutyList(guildId) {
    const queue = await getQueue(guildId);
    const ids = queue.map(d => d.userId);
    await store.writeJson(paths.onDutyDriversJson(guildId), ids);
}

module.exports = {
    getQueue,
    peekNextDriver,
    popNextDriver,
    pushToQueue,
    getPosition,
    removeFromQueue,
    incrementRideCount,
};
