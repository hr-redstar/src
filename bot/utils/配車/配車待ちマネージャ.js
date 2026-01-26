// utils/配車/配車待ちマネージャ.js
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 配車待ちキュー（Ride Waiting Queue）を取得する
 */
async function getRideQueue(guildId) {
    const path = paths.rideWaitingQueueJson(guildId);
    return await store.readJson(path, []).catch(() => []);
}

/**
 * キューにリクエストを追加する
 * @param {string} guildId
 * @param {Object} rideRequest
 */
async function addToRideQueue(guildId, rideRequest) {
    const path = paths.rideWaitingQueueJson(guildId);
    await store.updateJson(path, [], async (queue) => {
        const existingIdx = queue.findIndex(r => r.userId === rideRequest.userId);
        const entry = {
            ...rideRequest,
            timestamp: rideRequest.timestamp || new Date().toISOString()
        };
        if (existingIdx !== -1) {
            queue[existingIdx] = entry;
        } else {
            queue.push(entry);
        }
        return queue;
    });
}

/**
 * キューからリクエストを削除する
 */
async function removeFromRideQueue(guildId, userId) {
    const path = paths.rideWaitingQueueJson(guildId);
    await store.updateJson(path, [], async (queue) => {
        return queue.filter(r => r.userId !== userId);
    });
}

/**
 * 最も古いリクエストを取り出す (Priority Matching)
 */
async function popNextRideRequest(guildId) {
    const path = paths.rideWaitingQueueJson(guildId);
    let popped = null;
    await store.updateJson(path, [], async (queue) => {
        if (!queue || queue.length === 0) return queue;
        // timestampでソート
        queue.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        popped = queue.shift();
        return queue;
    });
    return popped;
}

/**
 * キュー内での順位を取得
 */
async function getRideQueuePosition(guildId, userId) {
    const queue = await getRideQueue(guildId);
    // ソート済みと仮定
    queue.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const idx = queue.findIndex(r => r.userId === userId);
    return idx === -1 ? null : idx + 1;
}

module.exports = {
    getRideQueue,
    addToRideQueue,
    removeFromRideQueue,
    popNextRideRequest,
    getRideQueuePosition
};
