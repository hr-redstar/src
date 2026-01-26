// utils/配車/待機列マネージャ.js
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 待機列（Waiting List）を取得する
 */
async function getQueue(guildId) {
  const waitPath = paths.waitingQueueJson(guildId);
  const queue = await store.readJson(waitPath, []).catch(() => []);

  // timestampで昇順ソート（念のため）
  return (queue || []).sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tA - tB;
  });
}

async function getPosition(guildId, userId) {
  const queue = await getQueue(guildId);
  const index = queue.findIndex(d => d.userId === userId);
  return index === -1 ? null : index + 1;
}

/**
 * 送迎者を待機列に追加 (Atomic)
 */
async function addToQueue(guildId, driverData) {
  const waitPath = paths.waitingQueueJson(guildId);
  await store.updateJson(waitPath, [], async (queue) => {
    const existingIndex = queue.findIndex(d => d.userId === driverData.userId);
    if (existingIndex !== -1) {
      queue[existingIndex] = { ...queue[existingIndex], ...driverData };
    } else {
      queue.push(driverData);
    }
    return queue;
  });
}

/**
 * 送迎者を待機列から削除 (Atomic)
 */
async function removeFromQueue(guildId, userId) {
  const waitPath = paths.waitingQueueJson(guildId);
  await store.updateJson(waitPath, [], async (queue) => {
    return queue.filter(d => d.userId !== userId);
  });
}

/**
 * 次の送迎者を取得し、列から取り出す (Fully Atomic Matching)
 */
async function popNextDriver(guildId) {
  const waitPath = paths.waitingQueueJson(guildId);
  let poppedDriver = null;

  await store.updateJson(waitPath, [], async (queue) => {
    if (!queue || queue.length === 0) return queue;

    // ソートを保証
    queue.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    poppedDriver = queue.shift();
    return queue;
  });

  return poppedDriver;
}

async function updateQueueItem(guildId, userId, updateData) {
  const waitPath = paths.waitingQueueJson(guildId);
  await store.updateJson(waitPath, [], async (queue) => {
    const idx = queue.findIndex(d => d.userId === userId);
    if (idx !== -1) {
      queue[idx] = { ...queue[idx], ...updateData };
    }
    return queue;
  });
}

module.exports = {
  getQueue,
  getPosition,
  addToQueue,
  removeFromQueue,
  updateQueueItem,
  popNextDriver,
};