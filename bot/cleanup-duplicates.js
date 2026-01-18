// データクリーンアップスクリプト
// 重複した待機中/配車中のエントリを削除し、各ユーザーにつき最新の1件のみを残す

const fs = require('fs');
const path = require('path');
const store = require('./utils/ストレージ/ストア共通');
const paths = require('./utils/ストレージ/ストレージパス');

const GUILD_ID = '1452724199557824514'; // テストギルドID

async function cleanupDuplicateEntries() {
    console.log('🧹 データクリーンアップを開始します...\n');

    // 1. 待機中の送迎者の重複を削除
    console.log('📋 待機中の送迎者をチェック中...');
    const waitingDriversDir = paths.waitingDriversDir(GUILD_ID);
    const waitingFiles = await store.listKeys(waitingDriversDir).catch(() => []);
    const waitingJsonFiles = waitingFiles.filter(f => f.endsWith('.json'));

    const driverWaitingMap = new Map(); // userId -> { file, timestamp }

    for (const fileKey of waitingJsonFiles) {
        const data = await store.readJson(fileKey).catch(() => null);
        if (data && data.userId) {
            const existing = driverWaitingMap.get(data.userId);
            const timestamp = new Date(data.timestamp || 0).getTime();

            if (!existing || timestamp > existing.timestamp) {
                // 古いファイルを削除
                if (existing) {
                    console.log(`  🗑️  削除: ${existing.file} (古い待機エントリ)`);
                    await store.deleteFile(existing.file);
                }
                driverWaitingMap.set(data.userId, { file: fileKey, timestamp });
            } else {
                // 現在のファイルが古い
                console.log(`  🗑️  削除: ${fileKey} (古い待機エントリ)`);
                await store.deleteFile(fileKey);
            }
        }
    }
    console.log(`✅ 待機中の送迎者: ${driverWaitingMap.size} 件を保持\n`);

    // 2. 配車中の重複を削除（ドライバーごとに最新1件のみ）
    console.log('📋 配車中のエントリをチェック中...');
    const activeDispatchDir = paths.activeDispatchDir(GUILD_ID);
    const dispatchFiles = await store.listKeys(activeDispatchDir).catch(() => []);
    const dispatchJsonFiles = dispatchFiles.filter(f => f.endsWith('.json'));

    const driverDispatchMap = new Map(); // driverId -> { file, timestamp }

    for (const fileKey of dispatchJsonFiles) {
        const data = await store.readJson(fileKey).catch(() => null);
        if (data && data.driverId) {
            const existing = driverDispatchMap.get(data.driverId);
            const timestamp = new Date(data.startedAt || data.createdAt || 0).getTime();

            if (!existing || timestamp > existing.timestamp) {
                // 古いファイルを削除
                if (existing) {
                    console.log(`  🗑️  削除: ${existing.file} (古い配車エントリ)`);
                    await store.deleteFile(existing.file);
                }
                driverDispatchMap.set(data.driverId, { file: fileKey, timestamp });
            } else {
                // 現在のファイルが古い
                console.log(`  🗑️  削除: ${fileKey} (古い配車エントリ)`);
                await store.deleteFile(fileKey);
            }
        }
    }
    console.log(`✅ 配車中: ${driverDispatchMap.size} 件を保持\n`);

    // 3. 待機中と配車中の両方に存在する場合、配車中を優先
    console.log('📋 待機中と配車中の重複をチェック中...');
    let conflictCount = 0;
    for (const [userId, waitingData] of driverWaitingMap.entries()) {
        if (driverDispatchMap.has(userId)) {
            console.log(`  🗑️  削除: ${waitingData.file} (配車中のため待機を削除)`);
            await store.deleteFile(waitingData.file);
            conflictCount++;
        }
    }
    console.log(`✅ ${conflictCount} 件の重複を解消\n`);

    console.log('🎉 クリーンアップ完了！');
}

cleanupDuplicateEntries().catch(err => {
    console.error('❌ エラーが発生しました:', err);
    process.exit(1);
});
