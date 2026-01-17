// src/bot/utils/storagePaths.js
// ここは「キー文字列（GCSならオブジェクト名 / ローカルなら相対パス）」を返すだけ

function guildRoot(guildId) {
  return `GCS/${guildId}`;
}

function configJson(guildId) {
  return `${guildRoot(guildId)}/config.json`;
}

// ギルド直下の一覧
function guildDriverIndexJson(guildId) {
  return `${guildRoot(guildId)}/送迎者/送迎者.json`;
}
function driverMasterListJson(guildId) {
  return `${guildRoot(guildId)}/送迎者/送迎者一覧.json`;
}
function onDutyDriversJson(guildId) {
  return `${guildRoot(guildId)}/送迎者/送迎中一覧.json`;
}

function guildUserIndexJson(guildId) {
  return `${guildRoot(guildId)}/利用者/利用者.json`;
}
function userMasterListJson(guildId) {
  return `${guildRoot(guildId)}/利用者/利用者一覧.json`;
}
function userInUseListJson(guildId) {
  return `${guildRoot(guildId)}/利用者/利用中一覧.json`;
}

// 全体送迎履歴
function globalRideHistoryJson(guildId, y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${guildRoot(guildId)}/送迎履歴/${y}/${mm}/${dd}/${y}${mm}${dd}_送迎履歴.json`;
}

// 送迎者 (個別)
function driverRoot(guildId) {
  return `${guildRoot(guildId)}/送迎者`;
}
function driverProfileJson(guildId, userId) {
  return `${driverRoot(guildId)}/${userId}/登録情報.json`;
}
function driverRideHistoryJson(guildId, userId, y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const ymd = `${y}${mm}${dd}`;
  return `${driverRoot(guildId)}/${userId}/送迎履歴/${y}/${mm}/${dd}/${ymd}_送迎履歴.json`;
}
function driverRatingJson(guildId, userId, y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const ymd = `${y}${mm}${dd}`;
  return `${driverRoot(guildId)}/${userId}/口コミ/${ymd}_口コミ.json`;
}

function ratingLogsDir(guildId) {
  return `${guildRoot(guildId)}/logs/評価`;
}

// 利用者 (個別)
function userRoot(guildId) {
  return `${guildRoot(guildId)}/利用者`;
}
function userProfileJson(guildId, userId) {
  return `${userRoot(guildId)}/${userId}/登録情報.json`;
}
function userRideHistoryJson(guildId, userId, y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const ymd = `${y}${mm}${dd}`;
  return `${userRoot(guildId)}/${userId}/利用履歴/${y}/${mm}/${dd}/${ymd}_利用履歴.json`;
}
function userRatingJson(guildId, userId, y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const ymd = `${y}${mm}${dd}`;
  return `${userRoot(guildId)}/${userId}/口コミ/${ymd}_口コミ.json`;
}

// 配車システム（FIFO / 進行中）
function waitingDriversDir(guildId) {
  return `${guildRoot(guildId)}/待機中の送迎者`;
}
function waitingUsersDir(guildId) {
  return `${guildRoot(guildId)}/待機中の利用者`;
}
function activeDispatchDir(guildId) {
  return `${guildRoot(guildId)}/配車中`;
}

// 相乗り募集
function carpoolDir(guildId) {
  return `${guildRoot(guildId)}/相乗り`;
}

module.exports = {
  configJson,
  guildDriverIndexJson,
  driverMasterListJson,
  onDutyDriversJson,

  guildUserIndexJson,
  userMasterListJson,
  userInUseListJson,

  globalRideHistoryJson,

  driverProfileJson,
  driverRideHistoryJson,
  driverRatingJson,

  userProfileJson,
  userRideHistoryJson,
  userRatingJson,

  waitingDriversDir,
  waitingUsersDir,
  activeDispatchDir,
  carpoolDir,
  ratingLogsDir,
};