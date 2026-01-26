// utils/配車/handoverProtocol.js
const store = require('../ストレージ/ストア共通');
const paths = require('../ストレージ/ストレージパス');
const { RideStatus } = require('../constants');

/**
 * 放置されているマッチングの自動解消と再割り当て
 * @param {import('discord.js').Guild} guild
 */
async function runHandoverCheck(guild) {
    const guildId = guild.id;
    const activeDir = paths.activeDispatchDir(guildId);
    const files = await store.listKeys(activeDir).catch(() => []);

    let purgedCount = 0;
    const TIMEOUT_MS = 10 * 60 * 1000; // 10分間放置でハンドオーバー
    const now = Date.now();

    for (const fileKey of files) {
        if (!fileKey.endsWith('.json')) continue;
        const data = await store.readJson(fileKey).catch(() => null);

        // MATCHEDステータスのまま10分以上経過しているか
        if (data && data.status === RideStatus.MATCHED && data.startedAt) {
            const startTime = new Date(data.startedAt).getTime();
            if (now - startTime > TIMEOUT_MS) {
                // ハンドオーバー発動
                await executeHandover(guild, data, fileKey);
                purgedCount++;
            }
        }
    }
}

/**
 * 具体的な解消処理
 */
async function executeHandover(guild, dispatchData, fileKey) {
    const { driverId, userId, rideId } = dispatchData;

    // 1. ドライバを待機列の最後に戻す（ペナルティ的に最後尾）
    const { addToQueue, removeFromQueue } = require('./待機列マネージャ');
    const { loadDriver } = require('../driversStore');
    const driverProfile = await loadDriver(guild.id, driverId);

    if (driverProfile) {
        await addToQueue(guild.id, {
            ...driverProfile,
            timestamp: new Date().toISOString() // 現在時刻で追加＝最後尾へ
        });
    }

    // 2. VCの削除
    if (dispatchData.vcId) {
        const vc = await guild.channels.fetch(dispatchData.vcId).catch(() => null);
        if (vc) await vc.delete('レスポンスタイムアウトによるハンドオーバー').catch(() => null);
    }

    // 3. 元のユーザーリクエストをキューの先頭に戻す
    const { addToRideQueue } = require('./配車待ちマネージャ');
    await addToRideQueue(guild.id, {
        userId: dispatchData.userId,
        direction: dispatchData.direction,
        persons: dispatchData.count,
        destination: dispatchData.destination,
        note: dispatchData.note,
        timestamp: new Date(0).toISOString() // Epoch(0)で追加＝最優先
    });

    // 4. マッチングデータの削除
    await store.deleteFile(fileKey).catch(() => null);

    // 5. ログ通知
    const { postGlobalLog } = require('../ログ/グローバルログ');
    await postGlobalLog({
        guild,
        content: `🚨 **ハンドオーバー発動**: ドライバー <@${driverId}> が応答しなかったため、配車依頼（<@${userId}>）を待機列の先頭に戻しました。`
    }).catch(() => null);
}

module.exports = { runHandoverCheck };
