const fs = require('fs');
const path = require('path');

const baseDataDir = path.resolve(__dirname, '../data');
const gcsDataDir = path.join(baseDataDir, 'GCS');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function migrate() {
    console.log('--- データ移行開始 ---');

    // 1. GCS フォルダ以下の移行
    if (fs.existsSync(gcsDataDir)) {
        console.log('GCSフォルダからの移行を開始します...');
        const guilds = fs.readdirSync(gcsDataDir);
        for (const guildId of guilds) {
            const srcGuildDir = path.join(gcsDataDir, guildId);
            const destGuildDir = path.join(baseDataDir, guildId);

            if (fs.statSync(srcGuildDir).isDirectory()) {
                ensureDir(destGuildDir);
                moveRecursive(srcGuildDir, destGuildDir);
            }
        }
        // GCSフォルダを削除（空なら）
        try {
            // fs.rmSync(gcsDataDir, { recursive: true, force: true });
            console.log('GCSフォルダからの移動が完了しました。');
        } catch (e) {
            console.error('GCSフォルダ削除失敗:', e);
        }
    }

    // 2. drivers フォルダから 送迎者 への移行とマージ
    const guilds = fs.readdirSync(baseDataDir);
    for (const guildId of guilds) {
        const guildDir = path.join(baseDataDir, guildId);
        if (!fs.statSync(guildDir).isDirectory()) continue;

        const oldDriversDir = path.join(guildDir, 'drivers');
        const newDriversDir = path.join(guildDir, '送迎者');

        if (fs.existsSync(oldDriversDir)) {
            console.log(`ギルド ${guildId} の drivers フォルダを処理します...`);
            ensureDir(newDriversDir);
            const files = fs.readdirSync(oldDriversDir);
            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                const userId = file.replace('.json', '');
                const oldFilePath = path.join(oldDriversDir, file);
                const newProfileDir = path.join(newDriversDir, userId);
                const newFilePath = path.join(newProfileDir, '登録情報.json');

                console.log(`  送迎者 ${userId} のデータを移行/マージします...`);
                ensureDir(newProfileDir);

                const oldData = JSON.parse(fs.readFileSync(oldFilePath, 'utf8'));
                let mergedData = oldData;

                if (fs.existsSync(newFilePath)) {
                    const existingNewData = JSON.parse(fs.readFileSync(newFilePath, 'utf8'));
                    // 新しい方のデータに history がない場合、古い方の history と current を優先
                    if (!existingNewData.current && oldData.current) {
                        mergedData = oldData;
                    } else if (existingNewData.current && oldData.current) {
                        // 両方ある場合は、日付が新しい方を current にするなどの処理が必要だが、
                        // 基本的に history が付いている oldData (drivers/以下) が本物と思われる
                        mergedData = oldData;
                    } else {
                        // 新しいファイルが旧形式（フラット）なら、旧形式データをラップ
                        // (今回は drivers/ 以下が既に current/history 構造なのでそれを尊重)
                    }
                }

                fs.writeFileSync(newFilePath, JSON.stringify(mergedData, null, 2), 'utf8');
                // 元ファイルを削除（安全のため一旦リネームに留めるか、削除するか）
                // fs.unlinkSync(oldFilePath);
            }
        }
    }

    console.log('--- データ移行完了 ---');
}

function moveRecursive(src, dest) {
    const items = fs.readdirSync(src);
    for (const item of items) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);

        if (fs.statSync(srcPath).isDirectory()) {
            ensureDir(destPath);
            moveRecursive(srcPath, destPath);
        } else {
            // ファイル移動
            if (fs.existsSync(destPath)) {
                console.log(`  スキップ (既存): ${item}`);
            } else {
                fs.renameSync(srcPath, destPath);
                console.log(`  移動: ${item}`);
            }
        }
    }
}

migrate();
