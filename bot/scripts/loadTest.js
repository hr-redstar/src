/**
 * 負荷試験スクリプト
 * ストレージ操作の並列実行や大量データ読み込みのパフォーマンステストを行う。
 */
require('dotenv').config();
const store = require('../utils/ストレージ/ストア共通');
const logger = require('../utils/logger');

async function runLoadTest() {
    const guildId = process.env.TEST_GUILD_ID || 'dummy_guild';
    console.log('🚀 負荷試験を開始します...');

    const start = Date.now();

    // 1. 並列読み込みテスト (キャッシュなし想定)
    console.log('--- 1. 並列読み込みテスト ---');
    const readStart = Date.now();
    try {
        const results = await Promise.all(
            Array.from({ length: 20 }, () => store.loadDrivers(guildId))
        );
        const readEnd = Date.now();
        console.log(`✅ 20並行 loadDrivers 完了: ${readEnd - readStart}ms`);
    } catch (err) {
        console.error('❌ 並列読み込み失敗:', err);
    }

    // 2. 再帰的キーリスト取得テスト
    console.log('--- 2. 再帰的キーリスト取得テスト ---');
    const listStart = Date.now();
    try {
        const keys = await store.listKeys(`GCS/${guildId}`, { recursive: true });
        const listEnd = Date.now();
        console.log(`✅ 再帰的 listKeys 完了 (${keys.length}件): ${listEnd - listStart}ms`);
    } catch (err) {
        console.error('❌ listKeys 失敗:', err);
    }

    const end = Date.now();
    console.log(`\n🏁 負荷試験終了！ 総所要時間: ${end - start}ms`);
}

runLoadTest().catch(console.error);
