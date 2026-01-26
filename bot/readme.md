# 送迎者Bot (Discord.js v14)

送迎・配車管理を自動化し、高い信頼性と追跡性を提供する Discord Bot です。

## 🎯 プロジェクトの現状
第3～第9フェーズの完遂により、**「設計の純潔化」「品質保証の自動化」「高度な運用ドキュメント整備」**が確立された堅牢な基盤に到達しています。

### 主要な到達点
- **自律型エコシステム (v3.0.0)**: 自己修復UI、自動サーバー構築、アトミックな配車整合性。
- **設計の純潔化**: Custom ID 分解やストレージ直参照を技術的に排除。
- **自動化の徹底**: CI (Lint/Format/Test) および Retention Agent によるメンテナンスの自動化。
- **信頼性・運用性**: TTLキャッシュ、指数バックオフ再試行、JSON監査ログ、およびルーティング基盤の完全同期。
- **運用ドキュメント**: [統合運用マニュアル v3.0.0](./OPERATIONS_MANUAL_v3.0.0.md) による管理・現場オペレーションの標準化。

## 🚀 セットアップ

### 必要条件
- Node.js >= 18.0.0
- Google Cloud プロジェクト (GCS利用の場合)

### インストール
```bash
cd bot
npm install
```

### 環境設定
`.env.example` を参考に `.env` ファイルを作成してください。

```bash
LOG_LEVEL=info
ENABLE_AUDIT_LOG=1
ENABLE_STORAGE_LOG=1
LOCAL_DATA=1 # ローカル開発時
# GCS_BUCKET=your-bucket-name
```

### 実行
```bash
npm run dev   # 開発モード (nodemon)
npm start     # 本番実行
```

## 🧪 テスト
```bash
npm test              # 全テスト実行
npm run test:coverage # カバレッジ測定
```

## 📜 監査ログ・履歴
管理者パネルから「システムログ」および「配車履歴」を閲覧可能です。
すべての重要操作は `tag` (CONFIG, SECURITY, RIDE 等) と共に JSON 形式で監査ログとして保存されます。

---
詳細は [リリースノート](./RELEASE_NOTES.md) および [技術完了報告書 (v3-v4)](./docs/reports/v3_v4_completion.md) を参照してください。
