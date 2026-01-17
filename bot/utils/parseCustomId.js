function parseCustomId(customId) {
  if (!customId || typeof customId !== 'string') return null;

  // v2: namespace|action|params
  if (customId.includes('|')) {
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

  // v1 (Legacy)
  if (customId.includes(':')) {
    const parts = customId.split(':');
    const isTyped = ['button', 'modal', 'select'].includes(parts[0]);

    const namespace = isTyped ? parts[1] : parts[0];
    const action = isTyped ? parts[2] : parts[1];
    if (!namespace || !action) return null;

    return {
      namespace,
      action,
      params: { legacy: parts.slice(isTyped ? 3 : 2) },
      raw: customId,
      legacy: true,
      version: 1,
      ...(isTyped ? { type: parts[0] } : {}),
    };
  }

  return null;
}

module.exports = { parseCustomId };
