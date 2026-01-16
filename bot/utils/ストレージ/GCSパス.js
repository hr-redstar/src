function ymdJst(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return { y, m, d, ymd: `${y}${m}${d}` };
}

function base(prefix, guildId) {
  return `${prefix}/${guildId}`;
}

function configPath(prefix, guildId) {
  return `${base(prefix, guildId)}/config.json`;
}

function driversIndexPath(prefix, guildId) {
  return `${base(prefix, guildId)}/送迎者.json`;
}

function driverRegPath(prefix, guildId, userId) {
  return `${base(prefix, guildId)}/送迎者/${userId}/登録情報.json`;
}

function usersIndexPath(prefix, guildId) {
  return `${base(prefix, guildId)}/利用者.json`;
}

function userRegPath(prefix, guildId, userId) {
  return `${base(prefix, guildId)}/利用者/${userId}/登録情報.json`;
}

function driverShiftPath(prefix, guildId, userId, date = new Date()) {
  const { y, m, d, ymd } = ymdJst(date);
  return `${base(prefix, guildId)}/送迎者/${userId}/${y}/${m}/${d}/${ymd}_シフト.json`;
}

module.exports = {
  ymdJst,
  configPath,
  driversIndexPath,
  driverRegPath,
  usersIndexPath,
  userRegPath,
  driverShiftPath,
};