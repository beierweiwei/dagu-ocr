import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('OCRApp', () => {
  beforeEach(() => {
    // 模拟浏览器环境
    global.window = {
      document: {
        getElementById: vi.fn().mockReturnValue(null)
      },
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn()
      }
    };
    global.localStorage = global.window.localStorage;
  });

  it('should initialize with default config', () => {
    const app = new OCRApp();
    expect(app.config).toEqual({
      baiduAk: '',
      baiduSk: '',
      aliAk: '',
      aliSk: '',
      baiduTranslateAppId: '',
      baiduTranslateSecretKey: '',
      sourceLang: 'auto',
      targetLang: 'zh'
    });
    expect(app.baiduAccessToken).toBeNull();
    expect(app.baiduTokenExpireTime).toBe(0);
    expect(app.history).toEqual([]);
    expect(app.historyExpanded).toBe(false);
  });

  it('should load config from localStorage on init', () => {
    const mockConfig = {
      baiduAk: 'test-ak',
      baiduSk: 'test-sk',
      aliAk: 'test-appcode',
      aliSk: '',
      baiduTranslateAppId: '',
      baiduTranslateSecretKey: '',
      sourceLang: 'auto',
      targetLang: 'zh'
    };
    global.window.localStorage.getItem.mockReturnValue(JSON.stringify(mockConfig));

    const app = new OCRApp();
    app.loadConfig();

    expect(app.config).toEqual(mockConfig);
    expect(global.window.localStorage.getItem).toHaveBeenCalledWith('ocr_config');
  });

  it('should save config to localStorage and close panel by default', () => {
    const app = new OCRApp();
    // 模拟配置输入框
    app.baiduAkInput = { value: 'new-ak' };
    app.baiduSkInput = { value: 'new-sk' };
    app.aliAkInput = { value: 'new-appcode' };
    app.aliSkInput = { value: '' };
    // 模拟hideConfigPanel方法
    app.hideConfigPanel = vi.fn();
    app.showStatus = vi.fn();

    app.saveConfig();

    expect(app.config.baiduAk).toBe('new-ak');
    expect(app.config.baiduSk).toBe('new-sk');
    expect(app.config.aliAk).toBe('new-appcode');
    expect(global.window.localStorage.setItem).toHaveBeenCalledWith(
      'ocr_config',
      JSON.stringify(app.config)
    );
    expect(app.showStatus).toHaveBeenCalledWith('✅ 配置保存成功');
    expect(app.hideConfigPanel).toHaveBeenCalled();
    expect(app.baiduAccessToken).toBeNull();
    expect(app.baiduTokenExpireTime).toBe(0);
  });

  it('should save config without closing panel when autoClose is false', () => {
    const app = new OCRApp();
    app.baiduAkInput = { value: 'test-ak' };
    app.baiduSkInput = { value: 'test-sk' };
    app.hideConfigPanel = vi.fn();
    app.showStatus = vi.fn();

    app.saveConfig(false);

    expect(app.hideConfigPanel).not.toHaveBeenCalled();
    expect(app.showStatus).toHaveBeenCalledWith('✅ 配置保存成功');
  });

  it('should handle save config error', () => {
    const app = new OCRApp();
    app.baiduAkInput = { value: 'test-ak' };
    app.baiduSkInput = { value: 'test-sk' };
    app.hideConfigPanel = vi.fn();
    app.showStatus = vi.fn();
    // 模拟localStorage保存失败
    global.window.localStorage.setItem.mockImplementation(() => {
      throw new Error('Storage error');
    });

    app.saveConfig();

    expect(app.showStatus).toHaveBeenCalledWith('❌ 配置保存失败');
    expect(app.hideConfigPanel).toHaveBeenCalled();
  });

  it('should show and hide config panel', () => {
    const app = new OCRApp();
    app.configPanel = { style: { display: 'none' } };

    app.showConfigPanel();
    expect(app.configPanel.style.display).toBe('block');

    app.hideConfigPanel();
    expect(app.configPanel.style.display).toBe('none');
  });

  it('should test config correctly', async () => {
    const app = new OCRApp();
    app.baiduAkInput = { value: 'test-ak' };
    app.baiduSkInput = { value: 'test-sk' };
    app.hideConfigPanel = vi.fn();
    app.showStatus = vi.fn();
    // 模拟识别成功
    vi.spyOn(app, 'recognize').mockResolvedValue('测试成功');
    // mock setTimeout 立即执行
    vi.useFakeTimers();

    const testPromise = app.testConfig();
    // 保存配置时不关闭面板
    expect(app.showStatus).toHaveBeenCalledWith('🧪 正在测试配置...');
    expect(app.hideConfigPanel).not.toHaveBeenCalled();

    await testPromise;

    expect(app.showStatus).toHaveBeenCalledWith('✅ 配置测试成功！');
    // 测试成功后延迟1秒关闭
    vi.runAllTimers();
    expect(app.hideConfigPanel).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('should show error when config test fails', async () => {
    const app = new OCRApp();
    app.baiduAkInput = { value: 'wrong-ak' };
    app.baiduSkInput = { value: 'wrong-sk' };
    app.hideConfigPanel = vi.fn();
    app.showStatus = vi.fn();
    // 模拟识别失败 - 必须是认证相关的错误才会被认为是配置失败
    vi.spyOn(app, 'recognize').mockRejectedValue(new Error('token获取失败：invalid client'));

    await app.testConfig();

    expect(app.showStatus).toHaveBeenCalledWith(expect.stringContaining('❌ 配置测试失败'));
    expect(app.hideConfigPanel).not.toHaveBeenCalled(); // 测试失败不关闭面板
  });
});
