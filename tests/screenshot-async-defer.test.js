import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Screenshot OCR Async - defer until DOM initialized', () => {
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

  it('should defer screenshot capture until DOM initialized', () => {
    // 模拟ztools环境
    globalThis.window.ztools = {
      hideMainWindow: vi.fn(),
      showMainWindow: vi.fn()
    };

    const captureSpy = vi.spyOn(OCRApp.prototype, 'captureScreen').mockImplementation(() => {});

    const app = new OCRApp();
    // onPluginEnter 触发，此时 DOM 还没 initElements
    app.onPluginEnter({ code: 'screenshot-ocr' });

    // 应该暂存 pending
    expect(app.pendingPluginEnter).toEqual({ code: 'screenshot-ocr' });
    // 还没调用 capture
    expect(captureSpy).not.toHaveBeenCalled();

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

    // DOM 初始化
    app.initElements();
    app.showStatus = vi.fn();

    // 使用fake timers处理setTimeout
    vi.useFakeTimers();
    app.processPendingPluginEnter();

    // 执行所有定时器
    vi.runAllTimers();

    // 现在应该处理了
    expect(captureSpy).toHaveBeenCalled();
    expect(app.pendingPluginEnter).toBeNull();

    vi.useRealTimers();
  });
});
