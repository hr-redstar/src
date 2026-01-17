const { writeJson, readJson } = require('./ストレージ/ストア共通');
const { updateRegistrationJson } = require('./updateRegistrationJson');
const paths = require('./ストレージ/ストレージパス');

/**
 * 利用者データを履歴付きで保存
 */
module.exports.saveUser = async (guildId, userId, data) => {
  const path = paths.userProfileJson(guildId, userId);
  const existingJson = await readJson(path).catch(() => null);

  // 履歴構造で更新
  const updatedJson = updateRegistrationJson(existingJson, { ...data, userId });

  await writeJson(path, updatedJson);

  // インデックスファイルを更新 (利用者.json と 利用者一覧.json)
  const indexPath = paths.guildUserIndexJson(guildId);
  const ids = await readJson(indexPath, []).catch(() => []);
  if (!ids.includes(userId)) {
    ids.push(userId);
    await writeJson(indexPath, ids);
  }

  const masterPath = paths.userMasterListJson(guildId);
  const masterIds = await readJson(masterPath, []).catch(() => []);
  if (!masterIds.includes(userId)) {
    masterIds.push(userId);
    await writeJson(masterPath, masterIds);
  }
};

/**
 * 利用者の最新データを取得（後方互換性）
 */
module.exports.loadUser = async (guildId, userId) => {
  const path = paths.userProfileJson(guildId, userId);
  const json = await readJson(path).catch(() => null);
  if (!json) return null;

  // current構造がある場合はそれを返す、ない場合は旧形式として全体を返す
  return json.current || json;
};

/**
 * 利用者の完全なJSON（履歴含む）を取得
 */
module.exports.loadUserFull = async (guildId, userId) => {
  const path = paths.userProfileJson(guildId, userId);
  return await readJson(path).catch(() => null);
};
