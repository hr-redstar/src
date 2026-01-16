const store = require('./ストレージ/ストア共通');
const paths = require('./ストレージ/ストレージパス');

/**
 * ランク定義を読み込み
 * @returns {Promise<string[]>} ランク名の配列
 */
async function loadRanks(guildId) {
    const path = paths.rankDataJson(guildId);
    const ranks = await store.readJson(path).catch(() => []);
    return Array.isArray(ranks) ? ranks : [];
}

/**
 * ランク定義を保存
 * @param {string[]} rankList ランク名の配列
 */
async function saveRanks(guildId, rankList) {
    const path = paths.rankDataJson(guildId);
    await store.writeJson(path, rankList);
}

/**
 * ユーザーにランクを設定
 */
async function setUserRank(guildId, userId, role, rankName) {
    const { loadDriver, saveDriver } = require('./driversStore');
    const { loadUser, saveUser } = require('./usersStore');

    // プロファイルにランク情報を追加して保存
    let profile;
    if (role === 'driver') {
        profile = await loadDriver(guildId, userId);
        if (profile) {
            profile.rank = rankName;
            await saveDriver(guildId, userId, profile);
        }
    } else {
        profile = await loadUser(guildId, userId);
        if (profile) {
            profile.rank = rankName;
            await saveUser(guildId, userId, profile);
        }
    }
    return profile;
}

module.exports = {
    loadRanks,
    saveRanks,
    setUserRank
};
