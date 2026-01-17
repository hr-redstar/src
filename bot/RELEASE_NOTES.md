# 送迎者Bot – リリースノート（運用者・管理者向け）

📌 **概要**  
Discord 上で送迎・配車管理を自動化する Bot です。  
第3～第5フェーズの完了により、高精度な設計、自動テスト、リアルタイム統計、そして異常検知アラートを備えた堅牢なシステムが完成しました。

- **設計の純潔化**: Custom ID 解析の統一、ストレージ層の抽象化による高い保守性。
- **自動化の徹底**: CI による Lint / Format / Unit Test の自動実行。
- **信頼性・運用性**: TTL キャッシュ（10秒）、指数バックオフ再試行、JSON 監査ログ。
- **モニタリング・評価管理**: 稼働統計ダッシュボード、口コミランク管理、異常検知アラート通知。

---

## 🎯 主な到達点

### 1️⃣ 第3フェーズ：設計の純潔化と自動化
- **Custom ID 解析**: `parseCustomId` へのロジック集約による脆弱性排除。
- **ストレージ層抽象化**: ローカル/GCS を透過的に扱う facade (`ストア共通.js`)。
- **自動テスト**: Jest によるユニットテストと GitHub Actions での CI 完全同期。

### 2️⃣ 第4フェーズ：信頼性・観測容易性（Observability）
- **監査ログ（Audit Logs）**: 開発者向け(Human)と監査用(JSON)の2系統出力。
- **パフォーマンス**: TTL 付きインメモリキャッシュによる I/O 負荷の極小化。
- **障害耐性**: Interaction 無応答防止ロジックと GCS 再試行。

### 3️⃣ 第5フェーズ：モニタリング・統計分析・評価管理の強化
- **稼働統計システム**:
    - 送迎完了、相乗り参加、新規登録をリアルタイムに自動集計。
    - 日次・月次・累計の3レイヤーで稼働推移を追跡。
- **口コミランク管理パネル**:
    - ユーザーごとの詳細な評価分布（星数）とコメント履歴を確認。
    - 管理者による「ランク階級」の動的登録とユーザーへの付与。
- **自動アラート通知システム**:
    - プログラム内の致命的エラーを検知し、運営者ログへ即座に通知。
    - スタックトレースを含む詳細情報を添付し、初動の迅速化を実現。

---

## ⚡ 運用フロー（システム構造）

```mermaid
graph LR
    Discord[Discord Interaction] <-->|双方向応答| Parser(parseCustomId)
    Parser -->|解析済みデータ| Handler{Logic Handler}
    Handler -->|データ要求| Store[ストア共通.js]
    Store --> Cache{TTL Cache}
    Cache <-->|読込/書込| Storage[Storage Backend]
    Handler -->|ログ記録| Logger[Logger]
    Logger -->|保存/出力| Audit[Audit Log Store]
    Handler -->|統計更新| Stats[統計ストア.js]
    Stats -->|データ提供| AdminDash[管理者パネル]
    Handler -.->|アラート送信| Alert[アラート通知.js]
    Alert -->|重大エラー| Discord
    Handler -.->|ユーザーへ応答| Discord
```

---

## 🧰 運用・操作ガイド

### 1. Discord 上の操作
| 操作 | 内容 | 備考 |
| :--- | :--- | :--- |
| スラッシュコマンド `/panel` | 管理・案内パネルの設置 | 管理者権限が必要 |
| **📊 統計ダッシュボード** | 本日・今月の稼働状況確認 | 完了件数や新規登録者を表示 |
| **🏆 口コミランク管理** | 評価分布確認・ランク設定 | ユーザー信頼性の維持・向上 |
| **🚨 異常検知アラート** | 致命的エラーの自動通知 | 運営者チャンネルへ即時送信 |

### 2. サーバー管理（エンジニア向け）
| コマンド | 用途 |
| :--- | :--- |
| `npm start` | **本番起動** (通常運用) |
| `npm run dev` | **開発起動** (テスト・デバッグ) |
| `npm test` | 全自動テストの実行 |

---

## 📖 関連ドキュメント
- **[README (基本構成)](https://github.com/hr-redstar/src/blob/main/bot/README.md)**
- **[ARCHITECTURE (詳細設計)](https://github.com/hr-redstar/src/blob/main/bot/docs/ARCHITECTURE.md)**
- **[報告書 (Phase 5 完了報告)](file:///c:/Users/User/.gemini/antigravity/brain/4b410c02-14bd-41db-97d0-b89047dcf235/walkthrough.md)**

---
📅 **Last Updated**: 2026-01-17
