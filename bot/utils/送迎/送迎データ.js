const { readJson, writeJson } = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * 待機順・送迎中データの取得（新規設計用）
 */
async function loadRideData(guildId) {
  const file = paths.rideDataJson(guildId);
  return await readJson(file, {
    queue: [], // 待機中: [{ userId, currentLocation, since }]
    active: [], // 送迎中: [{ userId, from, via, to, requestId }]
  });
}

/**
 * 待機順・送迎中データの保存（新規設計用）
 */
async function saveRideData(guildId, data) {
  const file = paths.rideDataJson(guildId);
  await writeJson(file, data);
}

// --- 以下、旧 rideStore.js からの移行ロジック（必要に応じて参照される） ---

// (既存の rideStore.js のロジックをここに維持するか、
//  新しいフローで不要であれば整理して良いが、
//  副作用を避けるため主要なエクスポートは維持)

async function getRides(guildId) {
  const file = paths.rideRequestsJson(guildId);
  return await readJson(file, { seq: 1, offers: [], requests: [] });
}

// ... 他の rideStore.js の関数群が必要ならここに追加 ...
// 現状は loadRideData / saveRideData をメインとしてエクスポート

module.exports = {
  loadRideData,
  saveRideData,
  getRides,
};
