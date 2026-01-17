const { parseCustomId } = require('../utils/parseCustomId');

describe('parseCustomId', () => {
  test('v2 parse: namespace|action|key=value', () => {
    const raw = 'memo|thread|period=1week';
    const result = parseCustomId(raw);
    expect(result).toEqual({
      namespace: 'memo',
      action: 'thread',
      params: { period: '1week' },
      raw: raw,
      version: 2,
    });
  });

  test('v2 parse multiple params: ns|act|a=1&b=2', () => {
    const raw = 'ps|modal|sub=guide&cid=123';
    const result = parseCustomId(raw);
    expect(result.params).toEqual({ sub: 'guide', cid: '123' });
  });

  test('invalid formats return null', () => {
    expect(parseCustomId('')).toBeNull();
    expect(parseCustomId('onlyone')).toBeNull();
    expect(parseCustomId(null)).toBeNull();
  });
});
