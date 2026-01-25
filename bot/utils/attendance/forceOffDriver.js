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

  // 1. プロファイル確認
  const profilePath = paths.driverProfileJson(guildId, driverId);
  const profile = await store.readJson(profilePath).catch(() => null);

  // 2. 待機列から削除
  const waitPath = `${paths.waitingDriversDir(guildId)}/${driverId}.json`;
  const wasWaiting = (await store.readJson(waitPath).catch(() => null)) !== null;
  if (wasWaiting) {
    await store.deleteFile(waitPath).catch(() => { });
  }

  // 3. 配車中の送迎をクリーンアップ
  let clearedCount = 0;
  const activeDir = paths.activeDispatchDir(guildId);
  const activeFiles = await store.listKeys(activeDir).catch(() => []);
  const { stopCarpoolRecruitment } = require('../配車/相乗りマネージャ');

  for (const fileKey of activeFiles) {
    if (!fileKey.endsWith('.json')) continue;
    const data = await store.readJson(fileKey).catch(() => null);
    if (data && data.driverId === driverId) {
      // 相乗り募集があれば停止
      if (data.carpoolMessageId) {
        await stopCarpoolRecruitment(guild, data).catch(() => null);
      }
      // VC削除
      if (data.vcId) {
        const vc = await guild.channels.fetch(data.vcId).catch(() => null);
        if (vc) await vc.delete('ドライバー強制退勤による削除').catch(() => null);
      }
      // データ削除
      await store.deleteFile(fileKey).catch(() => null);
      clearedCount++;
    }
  }

  return {
    profile,
    wasWaiting,
    clearedCount
  };
}

module.exports = forceOffDriver;