const store = require('./ストレージ/ストア共通');
const paths = require('./ストレージ/ストレージパス');
const { updateRegistrationJson } = require('./updateRegistrationJson');

async function loadDriver(guildId, userId) {
  const path = paths.driverProfileJson(guildId, userId);
  const json = await store.readJson(path).catch(() => null);
  if (!json) return null;
  return json.current || json;
}

async function loadDriverFull(guildId, userId) {
  const path = paths.driverProfileJson(guildId, userId);
  return await store.readJson(path).catch(() => null);
}

async function saveDriver(guildId, userId, data) {
  const path = paths.driverProfileJson(guildId, userId);
  const existingJson = await store.readJson(path).catch(() => null);

  const updatedJson = updateRegistrationJson(existingJson, { ...data, userId });
  await store.writeJson(path, updatedJson);

  // Update master list
  const masterPath = paths.driverMasterListJson(guildId);
  const masterIds = await store.readJson(masterPath, []).catch(() => []);
  if (!masterIds.includes(userId)) {
    masterIds.push(userId);
    await store.writeJson(masterPath, masterIds);
  }
}

module.exports = {
  loadDriver,
  loadDriverFull,
  saveDriver,
};