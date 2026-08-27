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

// Simulates the real ZTools dbStorage: values are auto JSON-serialized,
// and the whole store is carried across machines by ZTools backup/sync.
function createRealDbStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn(async (key) => {
      const raw = values.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    }),
    setItem: vi.fn(async (key, value) => values.set(key, JSON.stringify(value))),
    removeItem: vi.fn(async (key) => values.delete(key)),
    values
  };
}

describe('cross-machine sync reproduction', () => {
  it('machine A enables secret sync, machine B restores backup', async () => {
    // ---- Machine A: user configures Baidu OCR and enables secret sync ----
    const cloudData = {};
    const dbA = createRealDbStorage();
    const storeA = new SettingsStore({
      win: { ztools: { dbStorage: dbA } },
      localStorage: createLocalStorage()
    });
    await storeA.save({
      ocrProviderId: 'builtin:baidu-ocr',
      translationProviderId: 'builtin:baidu-translation',
      baiduAk: 'ak-from-a',
      baiduSk: 'sk-from-a',
      baiduTranslateAppId: 'app-a',
      baiduTranslateSecretKey: 'secret-a',
      syncSecrets: true
    });
    // ZTools backup copies dbStorage to the cloud
    for (const [k, v] of dbA.values) cloudData[k] = v;

    // ---- Machine B: restores the backup, has no local secrets ----
    const dbB = createRealDbStorage(cloudData);
    const storeB = new SettingsStore({
      win: { ztools: { dbStorage: dbB } },
      localStorage: createLocalStorage()
    });
    const configB = await storeB.load();

    expect(configB.ocrProviderId).toBe('builtin:baidu-ocr');
    expect(configB.baiduAk).toBe('ak-from-a');
    expect(configB.baiduSk).toBe('sk-from-a');
  });

  it('machine B that previously saved empty keys still picks up synced secrets', async () => {
    const cloudData = {};
    const dbA = createRealDbStorage();
    const storeA = new SettingsStore({
      win: { ztools: { dbStorage: dbA } },
      localStorage: createLocalStorage()
    });
    await storeA.save({
      ocrProviderId: 'builtin:baidu-ocr',
      baiduAk: 'ak-from-a',
      baiduSk: 'sk-from-a',
      syncSecrets: true
    });
    for (const [k, v] of dbA.values) cloudData[k] = v;

    // Machine B used the plugin once before sync arrived and saved empty secrets
    const localB = createLocalStorage();
    const dbB = createRealDbStorage();
    const storeB1 = new SettingsStore({
      win: { ztools: { dbStorage: dbB } },
      localStorage: localB
    });
    await storeB1.save(await storeB1.load());

    // Now the backup is restored on top of dbStorage
    const dbB2 = createRealDbStorage(cloudData);
    const storeB2 = new SettingsStore({
      win: { ztools: { dbStorage: dbB2 } },
      localStorage: localB
    });
    const configB = await storeB2.load();

    expect(configB.baiduAk).toBe('ak-from-a');
    expect(configB.baiduSk).toBe('sk-from-a');
  });

  it('secret sync disabled: provider selection syncs but keys do not', async () => {
    const cloudData = {};
    const dbA = createRealDbStorage();
    const storeA = new SettingsStore({
      win: { ztools: { dbStorage: dbA } },
      localStorage: createLocalStorage()
    });
    await storeA.save({
      ocrProviderId: 'builtin:baidu-ocr',
      baiduAk: 'ak-from-a',
      baiduSk: 'sk-from-a',
      syncSecrets: false
    });
    for (const [k, v] of dbA.values) cloudData[k] = v;

    const dbB = createRealDbStorage(cloudData);
    const storeB = new SettingsStore({
      win: { ztools: { dbStorage: dbB } },
      localStorage: createLocalStorage()
    });
    const configB = await storeB.load();

    expect(configB.ocrProviderId).toBe('builtin:baidu-ocr');
    expect(configB.baiduAk).toBe('');
    expect(configB.baiduSk).toBe('');
  });
});
