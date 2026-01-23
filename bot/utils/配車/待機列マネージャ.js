const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 待機列（Waiting List）を取得する
 * 参加時刻（timestamp）の昇順（先着順）でソートして返す
 */
async function getQueue(guildId) {
  const dir = paths.waitingDriversDir(guildId);
  const files = await store.listKeys(dir).catch(() => []);
  
  const drivers = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const data = await store.readJson(file).catch(() => null);
    if (data) {
      drivers.push(data);
    }
  }

  // timestampで昇順ソート（古い順＝先着順）
  drivers.sort((a, b) => {
    const tA = new Date(a.timestamp).getTime();
    const tB = new Date(b.timestamp).getTime();
    return tA - tB;
  });

  return drivers;
}

async function getPosition(guildId, userId) {
  const queue = await getQueue(guildId);
  const index = queue.findIndex(d => d.userId === userId);
  return index === -1 ? null : index + 1;
}

async function addToQueue(guildId, driverData) {
  const waitPath = `${paths.waitingDriversDir(guildId)}/${driverData.userId}.json`;
  await store.writeJson(waitPath, driverData);
}

async function removeFromQueue(guildId, userId) {
  const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
  await store.delete(waitPath).catch(() => {}); // Ignore if not found
}

async function updateQueueItem(guildId, userId, updateData) {
  const waitPath = `${paths.waitingDriversDir(guildId)}/${userId}.json`;
  const data = await store.readJson(waitPath).catch(() => null);
  if (data) {
    const newData = { ...data, ...updateData };
    await store.writeJson(waitPath, newData);
  }
}

async function popNextDriver(guildId) {
  const queue = await getQueue(guildId);
  if (queue.length === 0) return null;

  const nextDriver = queue[0];
  await removeFromQueue(guildId, nextDriver.userId);
  return nextDriver;
}

module.exports = {
  getQueue,
  getPosition,
  addToQueue,
  removeFromQueue,
  updateQueueItem,
  popNextDriver,
};