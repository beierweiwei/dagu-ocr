import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../plugin/src/core/storage.js';
import { OCRApp } from '../plugin/src/ocr.js';

function createStore() {
  return {
    load: vi.fn().mockResolvedValue({ ...DEFAULT_CONFIG }),
    save: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi.fn().mockReturnValue([]),
    saveHistory: vi.fn(),
    clearHistory: vi.fn()
  };
}

function createProviderService() {
  const config = { ...DEFAULT_CONFIG };
  return {
    config,
    builtin: { config },
    refresh: vi.fn().mockResolvedValue({ ocr: [], translation: [] }),
    invoke: vi.fn()
  };
}

describe('OCRApp', () => {
  it('uses the explicit provider and storage-backed defaults', () => {
    const app = new OCRApp({ store: createStore(), providerService: createProviderService() });

    expect(app.config).toEqual(DEFAULT_CONFIG);
    expect(app.state.mode).toBe('ocr');
    expect(app.state.showUpload).toBe(true);
  });

  it('initializes config, provider options, and history from their stores', async () => {
    const store = createStore();
    const providerService = createProviderService();
    const options = {
      ocr: [{ id: 'ztools:ocr', label: '外部 OCR' }],
      translation: [{ id: 'ztools:translation', label: '外部翻译' }]
    };
    store.load.mockResolvedValue({ ...DEFAULT_CONFIG, ocrProviderId: 'ztools:ocr' });
    store.loadHistory.mockReturnValue([{ text: '历史文本', timestamp: 1 }]);
    providerService.refresh.mockResolvedValue(options);

    const app = new OCRApp({ store, providerService });
    await app.initialize();

    expect(app.config.ocrProviderId).toBe('ztools:ocr');
    expect(app.state.providerOptions).toEqual(options);
    expect(app.state.history).toEqual([{ text: '历史文本', timestamp: 1 }]);
    expect(app.ready).toBe(true);
  });

  it('saves the selected provider and secrets, then closes the config panel', async () => {
    const store = createStore();
    const app = new OCRApp({ store, providerService: createProviderService() });
    app.state.showConfig = true;

    await app.saveConfig({
      ocrProviderId: 'builtin:baidu-ocr',
      translationProviderId: 'builtin:mymemory',
      myMemoryKey: 'user-key'
    });

    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({
      ocrProviderId: 'builtin:baidu-ocr',
      translationProviderId: 'builtin:mymemory',
      myMemoryKey: 'user-key'
    }));
    expect(app.state.showConfig).toBe(false);
    expect(app.state.status).toBe('配置保存成功');
  });

  it('keeps the config panel open when saving for a provider test', async () => {
    const store = createStore();
    const app = new OCRApp({ store, providerService: createProviderService() });
    app.state.showConfig = true;

    await app.saveConfig({ ocrProviderId: 'builtin:baidu-ocr' }, false);

    expect(app.state.showConfig).toBe(true);
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('tests the selected OCR provider without hiding the panel on failure', async () => {
    const app = new OCRApp({ store: createStore(), providerService: createProviderService() });
    app.state.showConfig = true;
    app.config.ocrProviderId = 'builtin:baidu-ocr';
    vi.spyOn(app, 'recognize').mockRejectedValue(new Error('密钥无效'));

    const result = await app.testConfig();

    expect(result).toBe(false);
    expect(app.state.status).toContain('配置测试失败: 密钥无效');
    expect(app.state.showConfig).toBe(true);
  });

  it('shows only the text input when the translate command has no payload', () => {
    const app = new OCRApp({ store: createStore(), providerService: createProviderService() });
    app.initElements();

    app.onPluginEnter({ code: 'translate' });

    expect(app.state.mode).toBe('translate');
    expect(app.state.showTranslationInput).toBe(true);
    expect(app.state.showUpload).toBe(false);
    expect(app.state.showImage).toBe(false);
  });

  it('clears the processing view without clearing history', () => {
    const app = new OCRApp({ store: createStore(), providerService: createProviderService() });
    app.state.imageUrl = 'data:image/png;base64,image';
    app.state.resultText = '识别结果';
    app.state.showImage = true;
    app.state.showResult = true;
    app.history = [{ text: '历史结果', timestamp: 1 }];

    app.clearAll();

    expect(app.state.imageUrl).toBe('');
    expect(app.state.resultText).toBe('');
    expect(app.state.showImage).toBe(false);
    expect(app.state.showResult).toBe(false);
    expect(app.history).toHaveLength(1);
  });
});
