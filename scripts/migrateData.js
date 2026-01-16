const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { normalizeConfig } = require('../bot/utils/設定/設定マネージャ');

const DATA_DIR = path.resolve(__dirname, '../bot/data');

async function migrate() {
    console.log('🚀 データ移行を開始します...');

    if (!fs.existsSync(DATA_DIR)) {
        console.error('❌ データディレクトリが見つかりません:', DATA_DIR);
        return;
    }

    // 1. GCSフォルダの統合
    const gcsDir = path.join(DATA_DIR, 'GCS');
    if (fs.existsSync(gcsDir)) {
        console.log('📂 GCSフォルダの統合中...');
        const guilds = await fsp.readdir(gcsDir);
        for (const guildId of guilds) {
            const src = path.join(gcsDir, guildId);
            const dst = path.join(DATA_DIR, guildId);
            await mergeRecursive(src, dst);
        }
        // 削除は慎重に行うため、空になったら消す等の処理にする（今回は手動削除推奨でも良いが、自動でやるなら以下）
        // await fsp.rm(gcsDir, { recursive: true, force: true });
        console.log('✅ GCSフォルダのデータを移行しました。');
    }

    // 2. ギルドごとの処理
    const entries = await fsp.readdir(DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === 'GCS') continue;

        const guildId = entry.name;
        const guildDir = path.join(DATA_DIR, guildId);
        console.log(`\n--- Guild: ${guildId} ---`);

        // config.json の正規化
        const configPath = path.join(guildDir, 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(await fsp.readFile(configPath, 'utf8'));
                const normalized = normalizeConfig(config);
                await fsp.writeFile(configPath, JSON.stringify(normalized, null, 2), 'utf8');
                console.log('✅ config.json を正規化しました。');
            } catch (e) {
                console.error(`❌ config.json の処理に失敗: ${e.message}`);
            }
        }

        // 送迎者・利用者の移行
        await migrateProfiles(guildDir, '送迎者');
        await migrateProfiles(guildDir, '利用者');
    }

    console.log('\n✨ 全ての移行処理が完了しました。');
}

async function migrateProfiles(guildDir, type) {
    const dir = path.join(guildDir, type);
    if (!fs.existsSync(dir)) return;

    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const ids = [];

    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.json')) {
            const userId = entry.name.replace('.json', '');
            if (userId === type || userId === '送迎者一覧' || userId === '利用者一覧' || userId === 'index' || userId.includes('出勤中')) continue;

            const oldPath = path.join(dir, entry.name);
            const newDir = path.join(dir, userId);
            const newPath = path.join(newDir, '登録情報.json');

            console.log(`📦 プロファイル移行: ${type}/${userId}`);

            try {
                const data = JSON.parse(await fsp.readFile(oldPath, 'utf8'));
                let migrated = data;

                // 履歴形式への変換 (currentがない場合)
                if (!data.current) {
                    migrated = {
                        userId: userId,
                        current: {
                            ...data,
                            userId: userId,
                            registeredAt: data.registeredAt || new Date().toISOString(),
                        },
                        history: [],
                        registrationMessageId: data.registrationMessageId || null,
                    };
                }

                await fsp.mkdir(newDir, { recursive: true });
                await fsp.writeFile(newPath, JSON.stringify(migrated, null, 2), 'utf8');
                await fsp.unlink(oldPath); // 旧ファイルを削除
                ids.push(userId);
            } catch (e) {
                console.error(`❌ ${userId} の移行に失敗: ${e.message}`);
            }
        } else if (entry.isDirectory()) {
            ids.push(entry.name);
            // 既存のディレクトリ内も必要ならチェック（履歴形式か）
            const profilePath = path.join(dir, entry.name, '登録情報.json');
            if (fs.existsSync(profilePath)) {
                try {
                    const data = JSON.parse(await fsp.readFile(profilePath, 'utf8'));
                    if (!data.current) {
                        const migrated = {
                            userId: entry.name,
                            current: { ...data, userId: entry.name },
                            history: [],
                            registrationMessageId: data.registrationMessageId || null,
                        };
                        await fsp.writeFile(profilePath, JSON.stringify(migrated, null, 2), 'utf8');
                        console.log(`✅ ${type}/${entry.name} を履歴形式に更新しました。`);
                    }
                } catch (e) { }
            }
        }
    }

    // インデックスファイルの更新
    if (ids.length > 0) {
        const indexPath = path.join(dir, `${type}.json`);
        const masterPath = path.join(dir, `${type}一覧.json`);
        await fsp.writeFile(indexPath, JSON.stringify(ids, null, 2), 'utf8');
        await fsp.writeFile(masterPath, JSON.stringify(ids, null, 2), 'utf8');
        console.log(`✅ ${type} インデックスを更新しました。`);
    }
}

async function mergeRecursive(src, dst) {
    if (!fs.existsSync(dst)) {
        await fsp.mkdir(dst, { recursive: true });
    }
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const dstPath = path.join(dst, entry.name);
        if (entry.isDirectory()) {
            await mergeRecursive(srcPath, dstPath);
        } else {
            // 既存ファイルがある場合は上書きせずスキップ（またはマージロジックだが今回は単純化）
            if (!fs.existsSync(dstPath)) {
                await fsp.copyFile(srcPath, dstPath);
            }
        }
    }
}

migrate();
