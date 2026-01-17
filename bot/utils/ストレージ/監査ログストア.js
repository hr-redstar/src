const store = require('./ストア共通');
const paths = require('./ストレージパス');

/**
 * 監査ログの保存
 */
async function saveAuditLog(guildId, data) {
    const timestamp = new Date();
    const y = timestamp.getFullYear();
    const m = String(timestamp.getMonth() + 1).padStart(2, '0');
    const d = String(timestamp.getDate()).padStart(2, '0');
    const id = Date.now();

    const key = `${paths.auditLogsDir(guildId)}/${y}/${m}/${d}/${id}.json`;
    await store.writeJson(key, {
        ...data,
        time: timestamp.toISOString(),
    });
}

/**
 * 監査ログの検索（簡易フィルタ）
 */
async function findAuditLogs(guildId, options = {}) {
    const { tag, actor, limit = 50, from, to } = options;
    const root = paths.auditLogsDir(guildId);

    // 本来はインデックス等が必要だが、設計準拠で「全部読む」のを避けつつ探索
    // ここでは指定された日付、または全履歴から再帰的に取得（コストに注意）
    const keys = await store.listKeys(root, { recursive: true });

    // ソートして最新から処理
    keys.sort().reverse();

    const results = [];
    for (const key of keys) {
        if (!key.endsWith('.json')) continue;
        if (results.length >= limit) break;

        const data = await store.readJson(key).catch(() => null);
        if (!data) continue;

        // フィルタ
        if (tag && data.tag !== tag) continue;
        if (actor && data.actor !== actor) continue;

        const logTime = new Date(data.time);
        if (from && logTime < from) continue;
        if (to && logTime > to) continue;

        results.push(data);
    }

    return results;
}

module.exports = {
    saveAuditLog,
    findAuditLogs,
};
