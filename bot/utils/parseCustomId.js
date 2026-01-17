function parseCustomId(customId) {
    if (!customId || typeof customId !== 'string') return null;

    // v2: namespace|action|params
    if (!customId.includes('|')) return null;

    const [namespace, action, ...rest] = customId.split('|');
    if (!namespace || !action) return null;

    const paramStr = rest.join('|');
    const params = {};

    if (paramStr) {
        for (const pair of paramStr.split('&')) {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
                params[key] = value;
            }
        }
    }

    return { namespace, action, params, raw: customId, version: 2 };
}

module.exports = { parseCustomId };
