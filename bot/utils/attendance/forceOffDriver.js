const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');

/**
 * ドライバーを強制退勤させる（待機列から削除）
 * @param {Object} params
 * @param {import('discord.js').Guild} params.guild
 * @param {string} params.driverId
 * @param {import('discord.js').User} params.executor
 */
async function forceOffDriver({ guild, driverId, executor }) {
  const guildId = guild.id;

  // プロファイル確認 (存在チェック用)
  const profilePath = paths.driverProfileJson(guildId, driverId);
  const profile = await store.readJson(profilePath).catch(() => null);

  // 待機列から削除
  const waitPath = `${paths.waitingDriversDir(guildId)}/${driverId}.json`;
  const wasWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;

  if (wasWaiting) {
    await store.deleteFile(waitPath);
  }

  return {
    profile,
    wasWaiting,
  };
}

module.exports = forceOffDriver;