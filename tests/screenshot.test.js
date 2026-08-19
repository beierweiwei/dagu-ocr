import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Screenshot Capture', () => {
  beforeEach(() => {
    global.Tesseract = {
      createWorker: vi.fn().mockResolvedValue({
        loadLanguage: vi.fn().mockResolvedValue(),
        initialize: vi.fn().mockResolvedValue(),
        recognize: vi.fn().mockResolvedValue({ data: { text: 'Screenshot text' } })
      })
    };
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
  });

  it('should use ztools.screenCapture with callback when available', () => {
    const mockCapture = vi.fn((callback) => {
      callback('data:image/png;base64,screenshot');
    });
    globalThis.window.ztools = {
      screenCapture: mockCapture
    };

    const app = new OCRApp();
    app.initElements();
    app.processImageUrl = vi.fn();
    app.captureScreen(app.processImageUrl);

    expect(mockCapture).toHaveBeenCalled();
    expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,screenshot');
  });

  it('should handle plugin enter for screenshot-ocr code', () => {
    const mockCapture = vi.fn((callback) => {
      callback('data:image/png;base64,screenshot');
    });
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
    app.initElements();
    app.processImageUrl = vi.fn();
    app.recognizeAndUpdateAutoExit = vi.fn();
    app.showStatus = vi.fn();

    // 使用fake timers处理setTimeout
    vi.useFakeTimers();
    app.onPluginEnter({ code: 'screenshot-ocr' });

    // 执行所有定时器
    vi.runAllTimers();

    expect(mockCapture).toHaveBeenCalled();
    expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,screenshot');
    expect(app.recognizeAndUpdateAutoExit).toHaveBeenCalledWith('data:image/png;base64,screenshot');

    vi.useRealTimers();
  });

  it('should handle image paste from ZTools img command', () => {
    const app = new OCRApp();

    // 模拟必要的DOM元素，包括configPanel
    const mockElement = { classList: { add: vi.fn(), remove: vi.fn() } };
    global.document.getElementById = vi.fn((id) => {
      if (id === 'preview' || id === 'loading' || id === 'resultArea' || id === 'status') {
        return mockElement;
      }
      if (id === 'resultText') {
        return { value: '', focus: vi.fn() };
      }
      if (id === 'configPanel') {
        return { style: { display: 'none' } };
      }
      return null;
    });

    app.initElements();
    app.processImageUrl = vi.fn();
    app.recognizeAndUpdate = vi.fn(); // 模拟识别方法，避免实际调用
    app.showStatus = vi.fn();

    app.onPluginEnter({ code: 'img-ocr', type: 'img', payload: 'data:image/png;base64,pasted' });

    expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,pasted');
    expect(app.recognizeAndUpdate).toHaveBeenCalledWith('data:image/png;base64,pasted');
  });
});
