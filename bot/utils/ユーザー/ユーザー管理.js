const store = require("../ストレージ/ストア共通");
const paths = require("../ストレージ/ストレージパス");

/**
 * 利用者.json の基本スキーマ:
 * { "ids": ["123", "456"], "updatedAt": "..." }
 */
async function getUserIds(guildId) {
  const p = paths.userListJson(guildId);
  const json = await store.readJson(p, { ids: [], updatedAt: null });
  const ids = Array.isArray(json?.ids) ? json.ids : [];
  return ids.map(String);
}

async function isRegisteredUser(guildId, userId) {
  const ids = await getUserIds(guildId);
  return ids.includes(String(userId));
}

/**
 * 利用者登録時に
 * - 利用者/利用者.json へ userId 追加
 * - 利用者/ユーザーID/登録情報.json を保存
 */
async function upsertUserRegistration(guildId, userId, regInfo) {
  // 1) user list
  await store.updateJson(paths.userListJson(guildId), { ids: [] }, (current) => {
    const ids = new Set(Array.isArray(current.ids) ? current.ids.map(String) : []);
    ids.add(String(userId));
    return { ...current, ids: Array.from(ids), updatedAt: new Date().toISOString() };
  });

  // 2) user profile
  const profilePath = paths.userProfileJson(guildId, userId);
  const nextReg = {
    userId: String(userId),
    ...regInfo, // { name, landmark }
    updatedAt: new Date().toISOString(),
  };
  await store.writeJson(profilePath, nextReg);

  return true;
}

module.exports = {
  getUserIds,
  isRegisteredUser,
  upsertUserRegistration,
};