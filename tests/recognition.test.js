import { describe, expect, it, vi } from 'vitest';
import { BuiltinProviderService, ProviderService } from '../plugin/src/core/providers.js';
import { DEFAULT_CONFIG } from '../plugin/src/core/storage.js';
import { OCRApp } from '../plugin/src/ocr.js';

const image = 'data:image/png;base64,dGVzdA==';

describe('Provider-backed recognition and translation', () => {
  it('gets and caches a Baidu OCR token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'token', expires_in: 3600 })
    });
    const service = new BuiltinProviderService({
      config: { baiduAk: 'ak', baiduSk: 'sk' },
      fetchImpl
    });

    await expect(service.getBaiduAccessToken()).resolves.toBe('token');
    await expect(service.getBaiduAccessToken()).resolves.toBe('token');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('recognizes with Baidu when the selected built-in provider is invoked', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ access_token: 'token', expires_in: 3600 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ words_result: [{ words: 'Hello' }, { words: 'World' }] })
      });
    const service = new BuiltinProviderService({
      config: { baiduAk: 'ak', baiduSk: 'sk' },
      fetchImpl
    });

    await expect(service.recognizeByBaidu(image)).resolves.toBe('Hello\nWorld');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('requires an explicit OCR provider and does not fall back', async () => {
    const config = { ...DEFAULT_CONFIG, baiduAk: 'ak', baiduSk: 'sk' };
    const invoke = vi.fn((type, input, providerId) => {
      if (!providerId) throw new Error('请先选择 OCR Provider');
      return Promise.reject(new Error('百度失败'));
    });
    const providerService = {
      config,
      builtin: { config },
      invoke,
      refresh: vi.fn()
    };
    const app = new OCRApp({ providerService });
    app.config.baiduAk = 'ak';
    app.config.baiduSk = 'sk';

    await expect(app.recognize(image)).rejects.toThrow('请先选择 OCR Provider');
    expect(invoke).toHaveBeenCalledWith('ocr', { image }, '');

    app.config.ocrProviderId = 'builtin:baidu-ocr';
    await expect(app.recognize(image)).rejects.toThrow('百度失败');
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('uses exactly the selected translation provider', async () => {
    const config = { ...DEFAULT_CONFIG, translationProviderId: 'builtin:baidu-translation' };
    const invoke = vi.fn().mockResolvedValue('你好');
    const providerService = {
      config,
      builtin: { config },
      invoke,
      refresh: vi.fn()
    };
    const app = new OCRApp({ providerService });
    app.config.translationProviderId = 'builtin:baidu-translation';

    await expect(app.translate('hello', 'en', 'zh')).resolves.toBe('你好');
    expect(invoke).toHaveBeenCalledWith(
      'translation',
      { text: 'hello', from: 'en', to: 'zh' },
      'builtin:baidu-translation'
    );
  });

  it('requires a user-provided MyMemory key and sends it to the request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        responseStatus: 200,
        responseData: { translatedText: '你好' }
      })
    });
    const service = new BuiltinProviderService({
      config: { myMemoryKey: 'user-key' },
      fetchImpl
    });

    await expect(service.translateByMyMemory('hello', 'en', 'zh')).resolves.toBe('你好');
    expect(fetchImpl.mock.calls[0][0]).toContain('langpair=en%7Czh');
    expect(fetchImpl.mock.calls[0][0]).toContain('key=user-key');

    const withoutKey = new BuiltinProviderService({ config: {}, fetchImpl });
    await expect(withoutKey.translateByMyMemory('hello', 'en', 'zh'))
      .rejects.toThrow('请先配置 MyMemory key');
  });

  it('updates the translation result in application state', async () => {
    const config = { ...DEFAULT_CONFIG, translationProviderId: 'ztools:translation' };
    const providerService = {
      config,
      builtin: { config },
      invoke: vi.fn().mockResolvedValue('你好'),
      refresh: vi.fn()
    };
    const app = new OCRApp({ providerService });

    await app.translateAndUpdate('hello');

    expect(app.state.translateResult).toBe('你好');
    expect(app.state.showTranslateResult).toBe(true);
    expect(app.state.status).toBe('翻译完成');
  });
});

describe('ProviderService', () => {
  it('discovers ZTools providers and exposes built-ins together', async () => {
    const api = {
      getProviders: vi.fn(async (type) => [{ id: `mock-${type}`, label: `Mock ${type}` }])
    };
    const service = new ProviderService({ win: { ztools: { providers: api } } });

    const options = await service.refresh();

    expect(options.ocr.map((item) => item.id)).toEqual([
      'ztools:default',
      'ztools:mock-ocr',
      'builtin:baidu-ocr',
      'builtin:ali-ocr'
    ]);
    expect(options.translation.map((item) => item.id)).toContain('ztools:mock-translation');
  });

  it('invokes a selected external provider by id', async () => {
    const api = {
      getProviders: vi.fn(async (type) => [{ id: `mock-${type}`, label: `Mock ${type}` }]),
      invokeProvider: vi.fn().mockResolvedValue({ text: '外部结果' })
    };
    const service = new ProviderService({ win: { ztools: { providers: api } } });
    await service.refresh();

    await expect(service.invoke('ocr', { image }, 'ztools:mock-ocr')).resolves.toBe('外部结果');
    expect(api.invokeProvider).toHaveBeenCalledWith('ocr', { image }, 'mock-ocr');
  });

  it('passes Microsoft-compatible Chinese language codes to external translation providers', async () => {
    const api = {
      getProviders: vi.fn(async (type) => type === 'translation'
        ? [{ id: 'microsoft-translation', label: '微软翻译' }]
        : []),
      invokeProvider: vi.fn().mockResolvedValue({ text: '你好' })
    };
    const service = new ProviderService({ win: { ztools: { providers: api } } });
    await service.refresh();

    await expect(service.invoke(
      'translation',
      { text: 'hello', from: 'en', to: 'zh' },
      'ztools:microsoft-translation'
    )).resolves.toBe('你好');

    expect(api.invokeProvider).toHaveBeenCalledWith(
      'translation',
      { text: 'hello', from: 'en', to: 'zh-Hans' },
      'microsoft-translation'
    );
  });

  it('keeps common language codes for non-Microsoft translation providers', async () => {
    const api = {
      getProviders: vi.fn(async (type) => type === 'translation'
        ? [{ id: 'mock-translation', label: '测试翻译' }]
        : []),
      invokeProvider: vi.fn().mockResolvedValue({ text: '你好' })
    };
    const service = new ProviderService({ win: { ztools: { providers: api } } });
    await service.refresh();

    await service.invoke(
      'translation',
      { text: 'hello', from: 'en', to: 'zh' },
      'ztools:mock-translation'
    );

    expect(api.invokeProvider).toHaveBeenCalledWith(
      'translation',
      { text: 'hello', from: 'en', to: 'zh' },
      'mock-translation'
    );
  });

  it('maps the selected built-in provider language code before invocation', async () => {
    const service = new ProviderService();
    service.builtin = {
      invoke: vi.fn().mockResolvedValue('翻译结果')
    };

    await expect(service.invoke(
      'translation',
      { text: 'hello', from: 'en', to: 'ja' },
      'builtin:baidu-translation'
    )).resolves.toBe('翻译结果');

    expect(service.builtin.invoke).toHaveBeenCalledWith(
      'builtin:baidu-translation',
      { text: 'hello', from: 'en', to: 'jp' }
    );
  });

  it('filters language options using the selected external service profile', async () => {
    const api = {
      getProviders: vi.fn(async (type) => type === 'translation'
        ? [{ id: 'deepl-translation', label: 'DeepL' }]
        : [])
    };
    const service = new ProviderService({ win: { ztools: { providers: api } } });
    await service.refresh();

    const targetCodes = service
      .getTranslationLanguageOptions('ztools:deepl-translation', 'target')
      .map((language) => language.code);

    expect(targetCodes).toContain('ko');
    expect(targetCodes).not.toContain('th');
  });
});
