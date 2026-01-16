# パネルの Ephemeral 送信排除：実作業手順書 ＋ チェックリスト

## 🎯 目的
- 操作パネル（Embed）を ephemeral で送っている箇所を全廃
- パネルは必ずテキストチャンネルに通常送信 or edit
- 通知・選択UIのみ ephemeral に限定

## 1. 探索フェーズ
以下の grep コマンドで対象箇所を機械的に洗い出す。
`grep -R "ephemeral: true" src/bot`

### 危険パターン（要修正）
```javascript
// パネルとして NG
interaction.reply({
  embeds: [panelEmbed],
  components: panelComponents,
  ephemeral: true,
});
```

## 2. 修正パターン
### 正解パターン①：チャンネルに新規送信
```javascript
await interaction.channel.send({
  embeds: [panelEmbed],
  components: panelComponents,
});
await interaction.reply({
  content: "✅ パネルを表示しました",
  ephemeral: true,
});
```

### 正解パターン②：既存パネルを更新（edit）
```javascript
const msg = await channel.messages.fetch(messageId);
await msg.edit({
  embeds: [panelEmbed],
  components: panelComponents,
});
```

## 3. ファイル別チェックリスト
- [x] **handler/パネル設置/**
  - [x] パネル表示に reply(ephemeral) を使っていない
  - [x] `channel.send` または `sendOrUpdatePanel` を使用している
- [x] **handler/管理者パネル/**
  - [x] Embed が ephemeral で送られていない
  - [x] 操作後に再描画される
- [x] **handler/送迎パネル/**
  - [x] 公開 UI はチャンネル送信
  - [x] 個人確認のみ ephemeral
- [x] **handler/送迎処理/**
  - [x] 一覧パネルは edit 更新
  - [x] 状態変更時に自動再描画

## 4. 最終確認
- [x] `grep` で `panel + ephemeral` が 0 件
- [x] パネルがチャンネルに1枚だけ存在
- [x] 管理者以外が操作できない
