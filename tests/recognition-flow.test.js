import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('OCR Recognition Flow', () => {
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
        copyText: vi.fn().mockReturnValue(true),
        outPlugin: vi.fn()
      }
    };
    global.document = globalThis.window.document;
    global.localStorage = globalThis.window.localStorage;

    // 模拟必要的DOM元素
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
      if (id === 'historyList') {
        return { innerHTML: '' };
      }
      if (id === 'historyEmpty') {
        return { style: { display: 'none' } };
      }
      return null;
    });
  });

  describe('Recognition success flow', () => {
    it('should display edit interface when recognition succeeds', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'test-ak';
      app.config.baiduSk = 'test-sk';
      app.initElements();

      // 模拟识别成功
      vi.spyOn(app, 'recognize').mockResolvedValue('识别到的文字内容');
      app.showStatus = vi.fn();

      await app.recognizeAndUpdate('data:image/png;base64,test');

      expect(app.resultText.value).toBe('识别到的文字内容');
      expect(app.resultArea.classList.add).toHaveBeenCalledWith('show');
      expect(app.showStatus).toHaveBeenCalledWith('✅ 识别完成，请编辑确认');
    });
  });

  describe('Recognition empty result flow', () => {
    it('should show manual input prompt and not exit automatically when result is empty', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'test-ak';
      app.config.baiduSk = 'test-sk';
      app.initElements();
      app.showStatus = vi.fn();
      app.exitPlugin = vi.fn();

      // 模拟识别返回空结果
      vi.spyOn(app, 'recognize').mockResolvedValue('');

      await app.recognizeAndUpdateAutoExit('data:image/png;base64,blank');

      expect(app.resultText.value).toBe('');
      expect(app.resultArea.classList.add).toHaveBeenCalledWith('show');
      expect(app.showStatus).toHaveBeenCalledWith('⚠️ 未识别出文字，请手动输入');
      expect(app.exitPlugin).not.toHaveBeenCalled(); // 不自动退出
    });
  });

  describe('confirmResult method', () => {
    it('should save history, copy text and exit plugin correctly', () => {
      const app = new OCRApp();
      app.initElements();
      app.resultText.value = '用户编辑后的文字内容';
      app.showStatus = vi.fn();
      app.copyResultText = vi.fn().mockReturnValue(true);
      app.exitPlugin = vi.fn();
      app.saveHistory = vi.fn();
      app.renderHistory = vi.fn();

      vi.useFakeTimers();
      const result = app.confirmResult();

      expect(result).toBe(true);
      expect(app.saveHistory).toHaveBeenCalledWith('用户编辑后的文字内容');
      expect(app.renderHistory).toHaveBeenCalled();
      expect(app.copyResultText).toHaveBeenCalledWith('用户编辑后的文字内容');
      expect(app.showStatus).toHaveBeenCalledWith('✅ 已复制到剪贴板，即将退出...');

      vi.runAllTimers();
      expect(app.exitPlugin).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should show error when content is empty', () => {
      const app = new OCRApp();
      app.initElements();
      app.resultText.value = '';
      app.showStatus = vi.fn();
      app.copyResultText = vi.fn();
      app.exitPlugin = vi.fn();

      const result = app.confirmResult();

      expect(result).toBe(false);
      expect(app.showStatus).toHaveBeenCalledWith('没有可复制的内容');
      expect(app.copyResultText).not.toHaveBeenCalled();
      expect(app.exitPlugin).not.toHaveBeenCalled();
    });
  });

  describe('History saving', () => {
    it('should save history only once when user confirms, no duplicates', () => {
      const app = new OCRApp();
      app.initElements();
      app.resultText.value = '测试内容';
      app.copyResultText = vi.fn().mockReturnValue(true);
      app.exitPlugin = vi.fn();
      app.renderHistory = vi.fn();

      // 初始历史为空
      expect(app.history.length).toBe(0);

      // 第一次确认
      app.confirmResult();
      expect(app.history.length).toBe(1);
      expect(app.history[0].text).toBe('测试内容');

      // 第二次确认相同内容，应该去重
      app.confirmResult();
      expect(app.history.length).toBe(1); // 还是1条，没有重复

      // 确认不同内容
      app.resultText.value = '新的内容';
      app.confirmResult();
      expect(app.history.length).toBe(2); // 现在有2条
      expect(app.history[0].text).toBe('新的内容'); // 新内容在最前面
    });
  });

  describe('Keyboard shortcuts', () => {
    it('should trigger confirmResult when Ctrl+Enter is pressed', () => {
      const app = new OCRApp();
      // 模拟所有需要的元素
      app.fileInput = { addEventListener: vi.fn() };
      app.dropArea = { addEventListener: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() } };
      app.confirmBtn = { addEventListener: vi.fn() };
      app.copyBtn = { addEventListener: vi.fn() };
      app.clearBtn = { addEventListener: vi.fn() };
      app.historyHeader = { addEventListener: vi.fn() };
      app.clearHistoryBtn = { addEventListener: vi.fn() };
      app.configBtn = { addEventListener: vi.fn() };
      app.closeConfigBtn = { addEventListener: vi.fn() };
      app.saveConfigBtn = { addEventListener: vi.fn() };
      app.testConfigBtn = { addEventListener: vi.fn() };

      app.bindEvents(); // 绑定事件
      app.resultText = { value: '快捷键测试' };
      app.confirmResult = vi.fn();

      // 手动触发绑定的事件处理函数
      const event = { ctrlKey: true, key: 'Enter', preventDefault: vi.fn() };
      // 找到并调用keydown事件处理函数
      const keydownHandler = document.addEventListener.mock.calls.find(call => call[0] === 'keydown')[1];
      keydownHandler(event);

      expect(app.confirmResult).toHaveBeenCalled();
    });

    it('should trigger clearAll when Ctrl+L is pressed', () => {
      const app = new OCRApp();
      // 模拟所有需要的元素
      app.fileInput = { addEventListener: vi.fn() };
      app.dropArea = { addEventListener: vi.fn(), classList: { add: vi.fn(), remove: vi.fn() } };
      app.confirmBtn = { addEventListener: vi.fn() };
      app.copyBtn = { addEventListener: vi.fn() };
      app.clearBtn = { addEventListener: vi.fn() };
      app.historyHeader = { addEventListener: vi.fn() };
      app.clearHistoryBtn = { addEventListener: vi.fn() };
      app.configBtn = { addEventListener: vi.fn() };
      app.closeConfigBtn = { addEventListener: vi.fn() };
      app.saveConfigBtn = { addEventListener: vi.fn() };
      app.testConfigBtn = { addEventListener: vi.fn() };

      app.bindEvents(); // 绑定事件
      app.clearAll = vi.fn();

      // 手动触发绑定的事件处理函数
      const event = { ctrlKey: true, key: 'l', preventDefault: vi.fn() };
      // 找到并调用keydown事件处理函数
      const keydownHandler = document.addEventListener.mock.calls.find(call => call[0] === 'keydown')[1];
      keydownHandler(event);

      expect(app.clearAll).toHaveBeenCalled();
    });
  });
});
