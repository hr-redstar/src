// src/bot/utils/ログ/rideLogStore.js
const { readJson, writeJson } = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 送迎運営ログのマッピングデータを読み込む
 */
async function loadLogMap(guildId) {
    const path = `guilds/${guildId}/operatorLogs/ride_logs.json`;
    const data = await readJson(path).catch(() => ({}));
    return data || {};
}

/**
 * 送迎運営ログのマッピングデータを保存する
 */
async function saveLogMap(guildId, map) {
    const path = `guilds/${guildId}/operatorLogs/ride_logs.json`;
    await writeJson(path, map);
}

/**
 * 特定の送迎（rideId）のメッセージ情報を取得
 */
async function getRideLog(guildId, rideId) {
    const map = await loadLogMap(guildId);
    return map[rideId] || null;
}

/**
 * 特定の送迎（rideId）のメッセージ情報を保存
 */
async function saveRideLog(guildId, rideId, messageRef) {
    const map = await loadLogMap(guildId);
    map[rideId] = messageRef;
    await saveLogMap(guildId, map);
}

/**
 * 特定の送迎（rideId）のメッセージ情報を削除
 */
async function removeRideLog(guildId, rideId) {
    const map = await loadLogMap(guildId);
    if (map[rideId]) {
        delete map[rideId];
        await saveLogMap(guildId, map);
    }
}

module.exports = {
    getRideLog,
    saveRideLog,
    removeRideLog,
};
