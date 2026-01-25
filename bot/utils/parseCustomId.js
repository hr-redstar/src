function parseCustomId(customId) {
    if (!customId || typeof customId !== 'string') return null;

    // v2: namespace|action|params
    // 例: op|directions|sub=detail_modal|key=1行目
    if (!customId.includes('|')) return null;

    const parts = customId.split('|');
    const namespace = parts[0];
    const actionFull = parts[1]; // action は "?" を含む可能性あり
    if (!namespace || !actionFull) return null;

    // action から実際の action 名と初期パラメータを分離（? 以降がある場合）
    let action = actionFull;
    const params = {};

    if (action.includes('?')) {
        const [a, query] = action.split('?');
        action = a;
        if (query) {
            query.split('&').forEach(p => {
                const [k, v] = p.split('=');
                if (k) params[k] = v;
            });
        }
    }

    // 残りのセグメント (|key=value など) をパースして params に追加
    for (let i = 2; i < parts.length; i++) {
        const segment = parts[i];
        if (segment.includes('=')) {
            // パラメータ形式であれば追加
            const [k, ...vParts] = segment.split('=');
            if (k) params[k] = vParts.join('='); // 値に = が含まれる可能性を考慮
        } else if (segment.includes('&')) {
            // セグメント内に & が含まれる場合 (レガシー/混在対応)
            segment.split('&').forEach(p => {
                const [k, v] = p.split('=');
                if (k) params[k] = v;
            });
        }
    }

    return { namespace, action, params, raw: customId, version: 2 };
}

module.exports = { parseCustomId };
