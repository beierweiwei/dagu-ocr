import { describe, expect, it, vi } from 'vitest';
import { SettingsStore, STORAGE_KEYS } from '../plugin/src/core/storage.js';

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn((key) => values.delete(key)),
    values
  };
}

function createDbStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn(async (key) => values.get(key) ?? null),
    setItem: vi.fn(async (key, value) => values.set(key, value)),
    removeItem: vi.fn(async (key) => values.delete(key)),
    values
  };
}

describe('SettingsStore', () => {
  it('loads preferences from dbStorage and keeps secrets local by default', async () => {
    const localStorage = createLocalStorage({
      [STORAGE_KEYS.localSecrets]: JSON.stringify({ baiduAk: 'local-ak' })
    });
    const dbStorage = createDbStorage({
      [STORAGE_KEYS.preferences]: {
        ocrProviderId: 'builtin:baidu-ocr',
        targetLang: 'en',
        syncSecrets: false
      },
      [STORAGE_KEYS.syncedSecrets]: { baiduAk: 'synced-ak' }
    });
    const store = new SettingsStore({
      win: { ztools: { dbStorage } },
      localStorage
    });

    const config = await store.load();

    expect(config.ocrProviderId).toBe('builtin:baidu-ocr');
    expect(config.targetLang).toBe('en');
    expect(config.baiduAk).toBe('local-ak');
  });

  it('writes syncable preferences and optional synced secrets separately', async () => {
    const localStorage = createLocalStorage();
    const dbStorage = createDbStorage();
    const store = new SettingsStore({
      win: { ztools: { dbStorage } },
      localStorage
    });
    const config = {
      ocrProviderId: 'builtin:ali-ocr',
      translationProviderId: 'builtin:mymemory',
      myMemoryKey: 'user-key',
      syncSecrets: true
    };

    await store.save(config);

    expect(dbStorage.values.get(STORAGE_KEYS.preferences)).toMatchObject({
      ocrProviderId: 'builtin:ali-ocr',
      translationProviderId: 'builtin:mymemory',
      syncSecrets: true
    });
    expect(dbStorage.values.get(STORAGE_KEYS.syncedSecrets)).toMatchObject({ myMemoryKey: 'user-key' });
    expect(JSON.parse(localStorage.values.get(STORAGE_KEYS.localSecrets))).toMatchObject({ myMemoryKey: 'user-key' });

    await store.save({ ...config, syncSecrets: false });
    expect(dbStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.syncedSecrets);
    expect(JSON.parse(localStorage.values.get(STORAGE_KEYS.localSecrets))).toMatchObject({ myMemoryKey: 'user-key' });
  });

  it('migrates the old localStorage config and removes the legacy record', async () => {
    const localStorage = createLocalStorage({
      [STORAGE_KEYS.legacyConfig]: JSON.stringify({
        baiduAk: 'legacy-ak',
        baiduSk: 'legacy-sk',
        sourceLang: 'en',
        targetLang: 'zh'
      })
    });
    const store = new SettingsStore({ win: {}, localStorage });

    const config = await store.load();

    expect(config.ocrProviderId).toBe('builtin:baidu-ocr');
    expect(config.baiduAk).toBe('legacy-ak');
    expect(config.sourceLang).toBe('en');
    expect(config.targetLang).toBe('zh-CN');
    expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.legacyConfig);
  });

  it('stores history locally and limits it to fifty records', () => {
    const localStorage = createLocalStorage();
    const store = new SettingsStore({ win: {}, localStorage });
    const history = Array.from({ length: 55 }, (_, index) => ({ text: String(index), timestamp: index }));

    store.saveHistory(history);

    const loaded = store.loadHistory();
    expect(loaded).toHaveLength(50);
    expect(loaded[0].text).toBe('0');
  });
});
