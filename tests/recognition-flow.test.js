import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../plugin/src/core/storage.js';
import { OCRApp } from '../plugin/src/ocr.js';

function createApp(invoke) {
  const config = { ...DEFAULT_CONFIG, ocrProviderId: 'ztools:ocr' };
  const store = {
    load: vi.fn().mockResolvedValue(config),
    save: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi.fn().mockReturnValue([]),
    saveHistory: vi.fn(),
    clearHistory: vi.fn()
  };
  const providerService = {
    config,
    builtin: { config },
    invoke: vi.fn(invoke),
    refresh: vi.fn().mockResolvedValue({ ocr: [], translation: [] })
  };
  const win = { ztools: { copyText: vi.fn().mockReturnValue(true) } };
  return new OCRApp({ store, providerService, win });
}

describe('OCR recognition flow', () => {
  it('shows the image and editable result after recognition', async () => {
    const app = createApp(async (type) => type === 'ocr' ? '识别到的文字' : '翻译结果');

    await app.recognizeAndUpdate('data:image/png;base64,image');

    expect(app.state.imageUrl).toContain('data:image/png');
    expect(app.state.showImage).toBe(true);
    expect(app.state.showResult).toBe(true);
    expect(app.state.resultText).toBe('识别到的文字');
    expect(app.state.status).toBe('识别完成，请编辑确认');
  });

  it('keeps an empty recognition result editable', async () => {
    const app = createApp(vi.fn().mockResolvedValue(''));

    await app.recognizeAndUpdate('data:image/png;base64,image');

    expect(app.state.showResult).toBe(true);
    expect(app.state.resultText).toBe('');
    expect(app.state.status).toBe('未识别出文字，可手动输入');
  });

  it('reruns OCR for the current image and clears the previous translation', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce('第一次识别')
      .mockResolvedValueOnce('第二次识别');
    const app = createApp(invoke);

    await app.recognizeAndUpdate('data:image/png;base64,image');
    app.state.showTranslateResult = true;
    app.state.translateResult = '旧译文';

    await app.recognizeAgain();

    expect(invoke).toHaveBeenCalledTimes(2);
    expect(app.state.resultText).toBe('第二次识别');
    expect(app.state.showTranslateResult).toBe(false);
    expect(app.state.translateResult).toBe('');
  });

  it('reports the selected provider error without trying another provider', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('当前 Provider 不可用'));
    const app = createApp(invoke);

    await app.recognizeAndUpdate('data:image/png;base64,image');

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(app.state.status).toContain('识别失败: 当前 Provider 不可用');
  });

  it('copies confirmed text and records it once in history', () => {
    const app = createApp(vi.fn());
    app.state.resultText = '用户编辑后的文字';

    expect(app.confirmResult()).toBe(true);
    expect(app.confirmResult()).toBe(true);

    expect(app.history).toHaveLength(1);
    expect(app.history[0].text).toBe('用户编辑后的文字');
  });
});
