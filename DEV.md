# 🛠 開発者ガイド (Developer Guide)

## 🚩 前提条件 (Prerequisites)

- **言語**: 日本語ネイティブ環境（開発者・利用者・ログのすべて）。
- **OS**: Linux系環境を基準とします。UTF-8エンコーディングを必須とします。
- **方針**: 運用可読性を最大化するため、日本語ディレクトリ名・ファイル名を許容します。

## 🏗 プロジェクト構造 (Directory Structure)

```
src/
├─ .github/             # GitHub Actions ワークフロー
├─ bot/                 # ボットソースコード本体
│  ├─ command/          # スラッシュコマンド定義
│  ├─ event/            # Discord イベントハンドラ
│  ├─ handler/          # インタラクション (Button/Modal/Select)
│  ├─ utils/            # 共通ユーティリティ
│  ├─ storage/          # データアクセス層
│  ├─ index.js          # エントリーポイント
│  └─ eslint.config.mjs # リント設定 (v9 Flag Config)
├─ 仕様書/               # プロジェクト全体の仕様ドキュメント
└─ README.md            # プロジェクト概要
```

## 📜 コーディング規約 (Coding Standards)

- **命名規則**: 
    - ファイル名: `camelCase.js` (小文字開始)
    - フォルダ名: `kebab-case` または日本語 (既存プロジェクトに倣う)
- **非同期処理**: `async/await` を基本とし、`Promise.then()` は避ける。
- **エラーハンドリング**: `try-catch` で適切にエラーを捕捉し、`logger.error` でログを出力すること。

## 🧩 カスタムID 仕様 (Custom ID Spec)

カスタムID は必ず `namespace|action|params` の形式で作成してください。
詳細は以下のドキュメントを参照してください。

👉 [カスタムID 仕様書](仕様書/開発者向け/92_カスタムID.md)

## 🧹 コード品質 (Quality Control)

本プロジェクトでは以下のツールを徹底して使用します。

- **ESLint**: 静的解析を行い、バグの芽を摘みます。
- **Prettier**: コードの見た目を自動整形します。

実行コマンド:
```bash
cd bot
npm run format  # 自動整形
npm run lint    # 静的解析
```

## 🧪 デバッグ・テスト (Debug & Test)

### ログの確認
`bot/utils/logger.js` を使用して、適切なレベルでログを出力してください。
- `debug`: 開発時の詳細情報
- `info`: 通常の動作記録
- `warn`: 軽微な問題
- `error`: 致命的な問題

### ローカル実行
`nodemon` を使用しています。ファイルを保存すると自動的に再起動します。
```bash
npm run dev
```

## ☁️ デプロイ (Deployment)

- `main` ブランチにプッシュすると、GitHub Actions がリントを開始し、その後 Google Cloud Run へ自動デプロイされます。
- デプロイの成功・失敗は GitHub の Actions タブで確認できます。
