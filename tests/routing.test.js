import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Routing Logic', () => {
  beforeEach(() => {
    globalThis.window = {
      document: {
        getElementById: vi.fn().mockReturnValue(null),
        addEventListener: vi.fn()
      },
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn()
      },
      ztools: {
        hideMainWindow: vi.fn(),
        showMainWindow: vi.fn(),
        screenCapture: vi.fn()
      }
    };
    global.document = globalThis.window.document;
    global.localStorage = globalThis.window.localStorage;

    // 模拟必要的DOM元素
    const mockElement = { classList: { add: vi.fn(), remove: vi.fn() } };
    global.document.getElementById = vi.fn((id) => {
      if (id === 'preview' || id === 'loading' || id === 'resultArea' || id === 'status' || id === 'dropArea') {
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
  });

  describe('Plugin entry routing', () => {
    it('should route screenshot-ocr code to screenshot handling', () => {
      const app = new OCRApp();
      app.initElements();
      app.handleScreenshotOCR = vi.fn();
      app.showStatus = vi.fn();

      app.onPluginEnter({ code: 'screenshot-ocr' });

      expect(app.handleScreenshotOCR).toHaveBeenCalled();
    });

    it('should route ocr code to main OCR handling', () => {
      const app = new OCRApp();
      app.initElements();
      app.handleOCRMain = vi.fn();
      app.readClipboardImage = vi.fn().mockResolvedValue(null);

      app.onPluginEnter({ code: 'ocr' });

      expect(app.handleOCRMain).toHaveBeenCalled();
    });

    it('should enable automatic translation for an image translation command', () => {
      const app = new OCRApp();
      app.initElements();
      app.processImageUrl = vi.fn();
      app.recognizeAndUpdate = vi.fn();

      app.onPluginEnter({ code: 'translate', type: 'img', payload: 'data:image/png;base64,test' });

      expect(app.autoTranslate).toBe(true);
      expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,test');
      expect(app.recognizeAndUpdate).toHaveBeenCalledWith('data:image/png;base64,test');
    });

    it('should handle img type payload directly regardless of code', () => {
      const app = new OCRApp();
      app.initElements();
      app.processImageUrl = vi.fn();
      app.recognizeAndUpdate = vi.fn();

      // 测试不同的code但都是img类型
      app.onPluginEnter({ code: 'any-code', type: 'img', payload: 'data:image/png;base64,test' });

      expect(app.processImageUrl).toHaveBeenCalledWith('data:image/png;base64,test');
      expect(app.recognizeAndUpdate).toHaveBeenCalledWith('data:image/png;base64,test');
    });
  });

  describe('Main OCR flow routing', () => {
    it('should use clipboard image when available', async () => {
      const app = new OCRApp();
      app.initElements();
      const mockClipboardImage = 'data:image/png;base64,clipboard';
      app.readClipboardImage = vi.fn().mockResolvedValue(mockClipboardImage);
      app.processImageUrlAutoExit = vi.fn();
      app.showDropArea = vi.fn();
      app.renderHistory = vi.fn();

      await app.handleOCRMain();

      expect(app.readClipboardImage).toHaveBeenCalled();
      expect(app.processImageUrlAutoExit).toHaveBeenCalledWith(mockClipboardImage);
      expect(app.showDropArea).not.toHaveBeenCalled(); // 不显示拖拽区域
      expect(app.renderHistory).not.toHaveBeenCalled();
    });

    it('should show drop area and history when clipboard has no image', async () => {
      const app = new OCRApp();
      app.initElements();
      app.readClipboardImage = vi.fn().mockResolvedValue(null);
      app.processImageUrlAutoExit = vi.fn();
      app.showDropArea = vi.fn();
      app.renderHistory = vi.fn();

      await app.handleOCRMain();

      expect(app.readClipboardImage).toHaveBeenCalled();
      expect(app.processImageUrlAutoExit).not.toHaveBeenCalled();
      expect(app.showDropArea).toHaveBeenCalled(); // 显示拖拽区域
      expect(app.renderHistory).toHaveBeenCalled(); // 显示历史记录
    });
  });

  describe('Pending plugin enter handling', () => {
    it('should store pending enter when DOM is not initialized', () => {
      const app = new OCRApp();
      // 不调用initElements，模拟DOM未初始化
      app.preview = null;
      app.dropArea = null;

      app.onPluginEnter({ code: 'screenshot-ocr' });

      expect(app.pendingPluginEnter).toEqual({ code: 'screenshot-ocr' });
    });

    it('should process pending enter after DOM initialization', () => {
      const app = new OCRApp();
      app.preview = null;
      app.dropArea = null;
      app.handlePluginEnter = vi.fn();

      // 先触发进入，此时DOM未初始化
      app.onPluginEnter({ code: 'ocr', type: 'img', payload: 'test.png' });
      expect(app.pendingPluginEnter).toEqual({ code: 'ocr', type: 'img', payload: 'test.png' });
      expect(app.handlePluginEnter).not.toHaveBeenCalled();

      // 初始化DOM
      app.preview = {};
      app.dropArea = {};
      app.processPendingPluginEnter();

      expect(app.handlePluginEnter).toHaveBeenCalledWith({ code: 'ocr', type: 'img', payload: 'test.png' });
      expect(app.pendingPluginEnter).toBeNull();
    });
  });
});
