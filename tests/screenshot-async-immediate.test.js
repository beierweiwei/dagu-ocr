import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Screenshot OCR Async - capture immediately when ready', () => {
  beforeEach(() => {
    // Reset globalThis.window
    globalThis.window = {
      ztools: undefined,
      document: {
        body: { appendChild: vi.fn(), removeChild: vi.fn() },
        getElementById: vi.fn().mockReturnValue({ addEventListener: vi.fn() }),
        createElement: vi.fn()
      },
      addEventListener: vi.fn(),
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn()
      }
    };
    global.document = globalThis.window.document;
    global.localStorage = globalThis.window.localStorage;
    // navigator already exists in node global, use it
    global.Tesseract = {
      createWorker: vi.fn().mockResolvedValue({
        loadLanguage: vi.fn().mockResolvedValue(),
        initialize: vi.fn().mockResolvedValue(),
        recognize: vi.fn().mockResolvedValue({ data: { text: 'Screenshot text' } })
      })
    };
  });

  it('should capture screenshot immediately when worker ready and DOM ready', () => {
    const mockCapture = vi.fn((cb) => cb('data:image/png;base64,screenshot'));
    globalThis.window.ztools = {
      screenCapture: mockCapture,
      hideMainWindow: vi.fn(),
      showMainWindow: vi.fn()
    };

    // 模拟必要的DOM元素
    const mockElement = { classList: { add: vi.fn(), remove: vi.fn() } };
    global.document.getElementById = vi.fn((id) => {
      if (id === 'preview' || id === 'loading' || id === 'resultArea' || id === 'status') {
        return mockElement;
      }
      if (id === 'resultText') {
        return { value: '', focus: vi.fn() };
      }
      return null;
    });

    const app = new OCRApp();
    // mock DOM elements
    app.initElements();
    app.processImageUrl = vi.fn();
    app.recognizeAndUpdateAutoExit = vi.fn();
    app.showStatus = vi.fn();

    // 使用fake timers处理setTimeout
    vi.useFakeTimers();
    app.handlePluginEnter({ code: 'screenshot-ocr' });

    // 执行所有定时器
    vi.runAllTimers();

    // captureScreen is called inside handlePluginEnter
    expect(mockCapture).toHaveBeenCalled();
    // callback is called immediately, so processImageUrl is called
    expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,screenshot');
    expect(app.recognizeAndUpdateAutoExit).toHaveBeenCalledWith('data:image/png;base64,screenshot');

    vi.useRealTimers();
  });
});
