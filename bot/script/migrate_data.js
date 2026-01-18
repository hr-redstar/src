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
  console.log('--- 旧データ構造から新構造(GCS/...)への移行開始 ---');

  if (!fs.existsSync(baseDataDir)) {
    console.log('Data directory not found:', baseDataDir);
    return;
  }

  const items = fs.readdirSync(baseDataDir);
  for (const item of items) {
    if (item === 'GCS') continue;

    const srcGuildDir = path.join(baseDataDir, item);
    if (!fs.statSync(srcGuildDir).isDirectory()) continue; // Skip files in root

    const guildId = item;
    const destGuildDir = path.join(gcsDataDir, guildId);
    ensureDir(destGuildDir);

    console.log(`\n📦 HUDDLE: Guild ${guildId}`);

    // 1. config.json の移動
    const oldConfig = path.join(srcGuildDir, 'config.json');
    if (fs.existsSync(oldConfig)) {
      const newConfig = path.join(destGuildDir, 'config.json');
      if (!fs.existsSync(newConfig)) {
        fs.copyFileSync(oldConfig, newConfig);
        console.log(`  ✅ config.json を移行しました`);
      } else {
        console.log(`  ⏩ config.json は既に存在するためスキップ`);
      }
    }

    // 2. drivers フォルダ (旧: drivers/userId.json) -> 送迎者/userId/登録情報.json
    const oldDriversDir = path.join(srcGuildDir, 'drivers');
    if (fs.existsSync(oldDriversDir)) {
      const files = fs.readdirSync(oldDriversDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const userId = file.replace('.json', '');
        const srcFile = path.join(oldDriversDir, file);

        const destDir = path.join(destGuildDir, '送迎者', userId);
        const destFile = path.join(destDir, '登録情報.json');

        ensureDir(destDir);
        if (!fs.existsSync(destFile)) {
          // データ構造が違う場合はここで変換が必要だが、
          // "昔のdata階層" が drivers/userId.json で中身が { current: {...}, history: [...] } ならそのまま使える
          // もし中身がフラットなら、ここで構造変更も可能。今回はそのままコピーする。
          const content = fs.readFileSync(srcFile);
          fs.writeFileSync(destFile, content);
          console.log(`  🚗 Driver ${userId} 移行完了`);
        }
      }
    }

    // 3. users フォルダ (旧: users/userId.json) -> 利用者/userId/登録情報.json
    const oldUsersDir = path.join(srcGuildDir, 'users');
    if (fs.existsSync(oldUsersDir)) {
      const files = fs.readdirSync(oldUsersDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const userId = file.replace('.json', '');
        const srcFile = path.join(oldUsersDir, file);

        const destDir = path.join(destGuildDir, '利用者', userId);
        const destFile = path.join(destDir, '登録情報.json');

        ensureDir(destDir);
        if (!fs.existsSync(destFile)) {
          const content = fs.readFileSync(srcFile);
          fs.writeFileSync(destFile, content);
          console.log(`  👤 User ${userId} 移行完了`);
        }
      }
    }
  }

  console.log('\n--- データ移行完了 ---');
  console.log('確認後、旧フォルダは手動で削除・バックアップしてください。');
}

migrate();
