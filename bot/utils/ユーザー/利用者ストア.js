const { readJson, writeJson, prefix } = require("../ストレージ/GCS_JSON");
const { usersIndexPath, userRegPath } = require("../ストレージ/GCSパス");

function defIndex() {
  return { version: 1, updatedAt: 0, users: {} };
}

async function getUsers(guildId) {
  const path = usersIndexPath(prefix, guildId);
  const idx = (await readJson(path)) ?? defIndex();
  return idx;
}

async function registerUser(guildId, userId, { area, stop, nickname }) {
  const now = Math.floor(Date.now() / 1000);

  // 1) 個別登録情報
  const regPath = userRegPath(prefix, guildId, userId);
  const oldReg = (await readJson(regPath)) || {};

  const newReg = {
    userId,
    area,
    stop,
    nickname,
    createdAt: oldReg.createdAt ?? now,
    updatedAt: now,
  };
  await writeJson(regPath, newReg);

  // 2) 一覧インデックス
  const idxPath = usersIndexPath(prefix, guildId);
  const idx = (await readJson(idxPath)) ?? defIndex();

  idx.users[userId] = { area, stop, nickname, updatedAt: now };
  idx.updatedAt = now;
  await writeJson(idxPath, idx);

  return idx;
}

async function deleteUser(guildId, userId) {
  const idxPath = usersIndexPath(prefix, guildId);
  const idx = (await readJson(idxPath)) ?? defIndex();

  if (idx.users[userId]) {
    delete idx.users[userId];
    idx.updatedAt = Math.floor(Date.now() / 1000);
    await writeJson(idxPath, idx);
  }
  return idx;
}

module.exports = { getUsers, registerUser, deleteUser };