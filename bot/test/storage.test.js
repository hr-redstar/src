const path = require('path');
const fs = require('fs');
const LocalBackend = require('../utils/ストレージ/backends/LocalBackend');

describe('LocalBackend', () => {
  const testDir = path.join(__dirname, 'tmp-data');
  const backend = new LocalBackend(testDir);

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('write and read JSON', async () => {
    const key = 'test/data.json';
    const data = { hello: 'world' };
    await backend.writeJson(key, data);

    const read = await backend.readJson(key);
    expect(read).toEqual(data);
  });

  test('exists', async () => {
    const key = 'exists-test.json';
    await backend.writeJson(key, { a: 1 });
    expect(await backend.exists(key)).toBe(true);
    expect(await backend.exists('non-existent.json')).toBe(false);
  });

  test('listKeys recursive', async () => {
    await backend.writeJson('a/1.json', { v: 1 });
    await backend.writeJson('a/b/2.json', { v: 2 });
    await backend.writeJson('c/3.json', { v: 3 });

    const keys = await backend.listKeys('a', { recursive: true });
    expect(keys).toContain('a/1.json');
    expect(keys).toContain('a/b/2.json');
    expect(keys).not.toContain('c/3.json');
  });

  test('deleteFile', async () => {
    const key = 'delete-me.json';
    await backend.writeJson(key, {});
    await backend.deleteFile(key);
    expect(await backend.exists(key)).toBe(false);
  });
});
