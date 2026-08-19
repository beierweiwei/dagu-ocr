import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Configuration Functionality', () => {
  beforeEach(() => {
    globalThis.window = {
      document: {
        getElementById: vi.fn().mockReturnValue(null)
      },
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn()
      }
    };
    global.localStorage = globalThis.window.localStorage;
  });

  describe('testConfig method', () => {
    it('should distinguish authentication errors from normal recognition errors', async () => {
      const app = new OCRApp();
      app.baiduAkInput = { value: 'test-ak' };
      app.baiduSkInput = { value: 'test-sk' };
      app.hideConfigPanel = vi.fn();
      app.showStatus = vi.fn();

      // 测试1：认证错误应该显示配置失败
      vi.spyOn(app, 'recognize').mockRejectedValue(new Error('token获取失败: invalid client'));
      await app.testConfig();
      expect(app.showStatus).toHaveBeenCalledWith(expect.stringContaining('❌ 配置测试失败'));
      expect(app.hideConfigPanel).not.toHaveBeenCalled();

      // 测试2：普通识别错误（比如空白图片）应该视为配置成功
      vi.spyOn(app, 'recognize').mockRejectedValue(new Error('识别失败: 未检测到文字'));
      vi.useFakeTimers();
      await app.testConfig();
      expect(app.showStatus).toHaveBeenCalledWith('✅ 配置测试成功！');
      vi.runAllTimers();
      expect(app.hideConfigPanel).toHaveBeenCalledTimes(1);
      vi.useRealTimers();

      // 测试3：阿里云认证错误
      vi.spyOn(app, 'recognize').mockRejectedValue(new Error('阿里云识别失败: InvalidAccessKeyId'));
      await app.testConfig();
      expect(app.showStatus).toHaveBeenCalledWith(expect.stringContaining('❌ 配置测试失败'));
    });

    it('should not treat blank image recognition as configuration failure', async () => {
      const app = new OCRApp();
      app.baiduAkInput = { value: 'valid-ak' };
      app.baiduSkInput = { value: 'valid-sk' };
      app.hideConfigPanel = vi.fn();
      app.showStatus = vi.fn();

      // 模拟识别返回空结果（空白图片）
      vi.spyOn(app, 'recognize').mockResolvedValue('');
      vi.useFakeTimers();

      await app.testConfig();

      expect(app.showStatus).toHaveBeenCalledWith('✅ 配置测试成功！');
      vi.runAllTimers();
      expect(app.hideConfigPanel).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should handle various authentication error messages correctly', async () => {
      const app = new OCRApp();
      app.baiduAkInput = { value: 'test-ak' };
      app.baiduSkInput = { value: 'test-sk' };
      app.showStatus = vi.fn();
      app.hideConfigPanel = vi.fn();

      // 测试各种认证相关的错误信息
      const authErrors = [
        'token获取失败',
        'invalid client',
        '认证失败',
        'invalidaccesskeyid',
        'signaturedoesnotmatch',
        'access key id',
        'secret key',
        '密钥错误',
        '权限不足',
        '未开通服务',
        'apikey无效',
        'invalid api key',
        '鉴权失败'
      ];

      for (const errorMsg of authErrors) {
        vi.spyOn(app, 'recognize').mockRejectedValue(new Error(errorMsg));
        await app.testConfig();
        expect(app.showStatus).toHaveBeenLastCalledWith(expect.stringContaining('❌ 配置测试失败'));
        expect(app.hideConfigPanel).not.toHaveBeenCalled();
      }

      // 测试非认证错误
      vi.spyOn(app, 'recognize').mockRejectedValue(new Error('网络超时'));
      await app.testConfig();
      expect(app.showStatus).toHaveBeenLastCalledWith('✅ 配置测试成功！');
    });
  });
});
