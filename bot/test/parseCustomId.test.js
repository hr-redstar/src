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

  test('v1 parse (Legacy): ns:act:p1:p2', () => {
    const raw = 'memo:thread:1week';
    const result = parseCustomId(raw);
    expect(result).toMatchObject({
      namespace: 'memo',
      action: 'thread',
      params: { legacy: ['1week'] },
      version: 1,
    });
  });

  test('v1 parse with type: button:ns:act:p1', () => {
    const raw = 'button:ps:setup:main';
    const result = parseCustomId(raw);
    expect(result).toMatchObject({
      type: 'button',
      namespace: 'ps',
      action: 'setup',
      params: { legacy: ['main'] },
      version: 1,
    });
  });

  test('invalid formats return null', () => {
    expect(parseCustomId('')).toBeNull();
    expect(parseCustomId('onlyone')).toBeNull();
    expect(parseCustomId(null)).toBeNull();
  });
});
