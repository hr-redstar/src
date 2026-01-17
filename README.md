# 🚗 送迎者Bot（Discord）

送迎者と利用者をマッチングし、配車・送迎・相乗り・評価までを一貫して管理する Discord 専用送迎支援 Bot です。

本 Bot は **Linux 環境を基準** に設計されており、Windows / macOS でのテストも可能ですが、最終的な動作保証は Linux（Google Cloud Run）とします。

## 📌 主な機能

### 送迎者向け
- 待機開始 / 退勤
- 現在地登録
- 送迎開始・終了操作
- 相乗り対応

### 利用者向け
- 配車依頼（自分 / ゲスト）
- 送迎状況確認
- 相乗り申請

### 管理者向け
- 各種パネル設置
- 送迎履歴管理
- 評価・ランク管理
- 管理ログ出力

## 🧩 技術仕様

- **Runtime**: Node.js (Discord.js v14)
- **Database**: ファイルベースストレージ (JSON)
- **Deployment**: Google Cloud Run (Linux) + GitHub Actions
- **Interaction**: Custom ID v2 仕様 (`namespace|action|params`)

### ディレクトリ構成（例）
```
bot/
├─ index.js           # エントリーポイント
├─ handler/           # インタラクションハンドラ
├─ utils/             # ユーティリティ (parseCustomId等)
├─ storage/           # データアクセサ
├─ data/              # ※ Git管理外 (ローカルデータ)
├─ node_modules/      # ※ Git管理外
├─ .env               # ※ Git管理外
└─ ...
```

## 🔐 セキュリティ・環境変数

**⚠️ 重要: Discord Bot Token は絶対に Git 管理しない**

- トークンは `.env` にのみ記載
- 本番環境（Cloud Run）では Secret Manager 経由で注入
- トークンが流出した場合は、直ちに Discord Developer Portal で再発行（Reset Token）を行ってください。

### .env の例
```ini
DISCORD_TOKEN=your_token_here
```

## 📖 開発者ガイド

プロジェクトの詳細な構成やコーディング規約については、[DEV.md](DEV.md) を参照してください。

## 💻 開発環境の統一方針

チーム開発における環境差異を防ぐため、以下の設定を推奨・必須とします。

### エディタ
- **Visual Studio Code (必須)**
- **文字コード**: UTF-8
- **改行コード**: LF
- **フォーマッタ**: Prettier (保存時自動整形 推奨)

### VS Code 設定推奨例 (.vscode/settings.json)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "files.encoding": "utf8",
  "files.eol": "\n"
}
```

### 実行環境 (Bot Server)
- **基準**: Linux 系 OS (Google Cloud Run)
- **テスト**: Windows / macOS / Linux
  - ※ 確認しやすさを優先して Windows/macOS での動作確認も可としますが、**「Windowsで動く」は動作保証になりません**。最終的な正の挙動は Linux です。

## 🚀 セットアップ手順

開発を開始するには以下の手順を実行してください。

```bash
# プロジェクトディレクトリへ移動
cd bot

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して DISCORD_TOKEN を設定してください

# 開発サーバー起動
npm run dev
```

### コード品質チェック
ESLint と Prettier を導入しています。コミット前に実行することを推奨します。

```bash
# リントチェック
npm run lint

# フォーマット
npm run format
```

## ☁️ デプロイ構成 (Google Cloud Run)

本プロジェクトは **CI/CD 前提** で運用されます。

- **本番環境**: Google Cloud Run (Linux)
- **デプロイ**: GitHub Actions (main ブランチへの push で自動デプロイ)
- **データ永続化**: Cloud Run はステートレスなため、コンテナ再起動でローカルファイルは初期化されます（JSONストレージは一時的なキャッシュや、永続化不要なデータのみに使用）。

## 📐 実装ルール

1. **パス操作**: 必ず `path.join()` を使用する（OS間のパス区切り文字の違いを吸収するため）。
2. **ファイル名**: 大文字・小文字を厳密に管理する（Linux では `file.js` と `File.js` は別物です）。
3. **Custom ID**: 新仕様 `namespace|action|params` を遵守し、`utils/parseCustomId` を利用してパースする。

## 📜 ライセンス
(Private / Custom License)
