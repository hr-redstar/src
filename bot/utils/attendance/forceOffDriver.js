// utils/attendance/forceOffDriver.js
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const { loadDriver, saveDriver } = require('../driversStore');
const { removeFromQueue } = require('../配車/待機列マネージャ');


/**
 * 送迎者を強制退勤させる（待機列・配車中の両方を解除）
 * @param {Object} options
 * @param {Guild} options.guild
 * @param {string} options.driverId
 * @param {User} options.executor 実行者（管理者）
 */
async function forceOffDriver({ guild, driverId, executor }) {
    const guildId = guild.id;

    // 1. プロファイルの更新 (offline化)
    const profile = await loadDriver(guildId, driverId);
    if (profile) {
        profile.available = false;
        profile.status = 'offline';
        profile.updatedAt = new Date().toISOString();
        await saveDriver(guildId, driverId, profile);
    }

    // 2. 待機列からの削除
    await removeFromQueue(guildId, driverId).catch(() => null);

    // 3. 配車中データのクリーンアップ
    const dispatchDir = paths.activeDispatchDir(guildId);
    const files = await store.listKeys(dispatchDir).catch(() => []);

    let clearedDispatch = null;
    let clearedCount = 0;
    for (const fileKey of files) {
        if (!fileKey.endsWith('.json')) continue;

        const data = await store.readJson(fileKey).catch(() => null);
        if (data && data.driverId === driverId) {
            if (!clearedDispatch) clearedDispatch = data;
            clearedCount++;
            await store.deleteFile(fileKey).catch(() => null);
        }
    }

    if (clearedCount > 1) {
        const logger = require('../../logger');
        logger.warn(`[FORCE_OFF] Driver ${driverId} had ${clearedCount} active dispatches. All cleared.`);
    }

    // 4. 運営者ログへの通知
    const logData = {
        driverId: driverId,
        driverNickname: profile?.nickname || '不明',
        ...clearedDispatch,
        status: clearedDispatch?.status || 'force_off'
    };

    if (clearedDispatch) {
        const { updateRideOperatorLog } = require('../ログ/rideLogManager');
        await updateRideOperatorLog({
            guild,
            rideId: clearedDispatch.dispatchId || clearedDispatch.rideId,
            status: 'FORCED',
            data: {
                driverId: driverId,
                driverNickname: profile?.nickname || '不明',
                userId: clearedDispatch.passengerId,
                area: clearedDispatch.direction || clearedDispatch.route || clearedDispatch.area,
                count: clearedDispatch.count,
                endedAt: new Date().toISOString(),
                forcedBy: executor.id,
            }
        }).catch(() => null);
    }

    return { success: true, profile, clearedDispatch, clearedCount };
}

module.exports = forceOffDriver;
