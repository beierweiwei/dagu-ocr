import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('OCR Recognition', () => {
  beforeEach(() => {
    global.window = {
      document: { getElementById: vi.fn().mockReturnValue(null) },
      localStorage: { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() },
      fetch: vi.fn()
    };
    global.fetch = global.window.fetch;
    vi.clearAllMocks();
  });

  describe('Baidu OCR', () => {
    it('should get Baidu access token when not available or expired', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'test-ak';
      app.config.baiduSk = 'test-sk';

      // 模拟token接口返回
      global.fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          access_token: 'test-token',
          expires_in: 2592000 // 30天
        })
      });

      const token = await app.getBaiduAccessToken();
      expect(token).toBe('test-token');
      expect(app.baiduAccessToken).toBe('test-token');
      expect(app.baiduTokenExpireTime).toBeGreaterThan(Date.now());
      expect(global.fetch).toHaveBeenCalledWith(
        'https://aip.baidubce.com/oauth/2.0/token',
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should use cached Baidu access token when not expired', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'test-ak';
      app.config.baiduSk = 'test-sk';
      app.baiduAccessToken = 'cached-token';
      app.baiduTokenExpireTime = Date.now() + 3600 * 1000; // 1小时后过期

      const token = await app.getBaiduAccessToken();
      expect(token).toBe('cached-token');
      expect(global.fetch).not.toHaveBeenCalled(); // 没有调用接口，使用缓存
    });

    it('should recognize image using Baidu OCR', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'test-ak';
      app.config.baiduSk = 'test-sk';

      // 模拟token获取
      vi.spyOn(app, 'getBaiduAccessToken').mockResolvedValue('test-token');
      // 模拟识别接口返回
      global.fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          words_result: [
            { words: 'Hello' },
            { words: 'World' }
          ]
        })
      });

      const result = await app.recognizeByBaidu('data:image/png;base64,testimg');
      expect(result).toBe('Hello\nWorld');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic'),
        expect.any(Object)
      );
    });
  });

  describe('Aliyun OCR', () => {
    it('should recognize image using Aliyun OCR', async () => {
      const app = new OCRApp();
      app.config.aliAk = 'test-accesskey-id';
      app.config.aliSk = 'test-accesskey-secret';

      // 模拟crypto API
      Object.defineProperty(global, 'crypto', {
        value: {
          subtle: {
            importKey: vi.fn().mockResolvedValue('test-key'),
            sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
          }
        },
        writable: true
      });
      Object.defineProperty(global, 'btoa', {
        value: vi.fn().mockReturnValue('test-signature'),
        writable: true
      });

      // 模拟阿里云识别接口返回
      global.fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          Code: 'Success',
          Data: JSON.stringify({
            prism_wordsInfo: [
              { word: '你好' },
              { word: '阿里云' }
            ]
          })
        })
      });

      const result = await app.recognizeByAli('data:image/png;base64,testimg');
      expect(result).toBe('你好\n阿里云');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://ocr-api.cn-hangzhou.aliyuncs.com/'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/octet-stream'
          })
        })
      );
    });

    it('should throw error when Aliyun OCR authentication fails', async () => {
      const app = new OCRApp();
      app.config.aliAk = 'wrong-accesskey-id';
      app.config.aliSk = 'wrong-accesskey-secret';

      // 模拟crypto API
      Object.defineProperty(global, 'crypto', {
        value: {
          subtle: {
            importKey: vi.fn().mockResolvedValue('test-key'),
            sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer)
          }
        },
        writable: true
      });
      Object.defineProperty(global, 'btoa', {
        value: vi.fn().mockReturnValue('test-signature'),
        writable: true
      });

      global.fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          Code: 'InvalidAccessKeyId',
          Message: 'Specified access key is not valid.'
        })
      });

      await expect(app.recognizeByAli('data:image/png;base64,testimg'))
        .rejects.toThrow('阿里云识别失败: Specified access key is not valid.');
    });

    it('should throw error when Aliyun OCR is not configured', async () => {
      const app = new OCRApp();
      // 没有配置阿里云密钥

      await expect(app.recognizeByAli('data:image/png;base64,testimg'))
        .rejects.toThrow('请先配置阿里云OCR AccessKey');
    });
  });

  describe('Main recognize method', () => {
    it('should use Baidu OCR first when both are configured', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'baidu-ak';
      app.config.baiduSk = 'baidu-sk';
      app.config.aliAk = 'ali-appcode';

      const baiduSpy = vi.spyOn(app, 'recognizeByBaidu').mockResolvedValue('百度识别结果');
      const aliSpy = vi.spyOn(app, 'recognizeByAli').mockResolvedValue('阿里云识别结果');

      const result = await app.recognize('data:image/png;base64,testimg');
      expect(result).toBe('百度识别结果');
      expect(baiduSpy).toHaveBeenCalled();
      expect(aliSpy).not.toHaveBeenCalled(); // 百度可用时不调用阿里云
    });

    it('should fallback to Aliyun OCR when Baidu fails', async () => {
      const app = new OCRApp();
      app.config.baiduAk = 'baidu-ak';
      app.config.baiduSk = 'baidu-sk';
      app.config.aliAk = 'ali-appcode';

      const baiduSpy = vi.spyOn(app, 'recognizeByBaidu').mockRejectedValue(new Error('百度失败'));
      const aliSpy = vi.spyOn(app, 'recognizeByAli').mockResolvedValue('阿里云识别结果');

      const result = await app.recognize('data:image/png;base64,testimg');
      expect(result).toBe('阿里云识别结果');
      expect(baiduSpy).toHaveBeenCalled();
      expect(aliSpy).toHaveBeenCalled(); // 百度失败后调用阿里云
    });

    it('should use Aliyun OCR when only Aliyun is configured', async () => {
      const app = new OCRApp();
      app.config.aliAk = 'ali-appcode';

      const baiduSpy = vi.spyOn(app, 'recognizeByBaidu');
      const aliSpy = vi.spyOn(app, 'recognizeByAli').mockResolvedValue('阿里云识别结果');

      const result = await app.recognize('data:image/png;base64,testimg');
      expect(result).toBe('阿里云识别结果');
      expect(baiduSpy).not.toHaveBeenCalled();
      expect(aliSpy).toHaveBeenCalled();
    });

    it('should throw error when no OCR is configured', async () => {
      const app = new OCRApp();
      // 没有配置任何OCR

      await expect(app.recognize('data:image/png;base64,testimg'))
        .rejects.toThrow('请先在配置页面填写百度OCR密钥或阿里云OCR AccessKey');
    });
  });

  describe('Translation', () => {
    it('should calculate a standard MD5 signature', () => {
      const app = new OCRApp();

      expect(app.md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
    });

    it('should call Baidu translation when its credentials are configured', async () => {
      const app = new OCRApp();
      app.config.baiduTranslateAppId = 'app-id';
      app.config.baiduTranslateSecretKey = 'secret-key';

      const baiduSpy = vi.spyOn(app, 'translateByBaidu').mockResolvedValue('你好');
      const result = await app.translate('hello', 'en', 'zh');

      expect(result).toBe('你好');
      expect(baiduSpy).toHaveBeenCalledWith('hello', 'en', 'zh');
    });

    it('should fall back to MyMemory when configured translation services fail', async () => {
      const app = new OCRApp();
      app.config.baiduTranslateAppId = 'app-id';
      app.config.baiduTranslateSecretKey = 'secret-key';
      vi.spyOn(app, 'translateByBaidu').mockRejectedValue(new Error('Baidu unavailable'));
      const myMemorySpy = vi.spyOn(app, 'translateByMyMemory').mockResolvedValue('你好');

      const result = await app.translate('hello', 'en', 'zh');

      expect(result).toBe('你好');
      expect(myMemorySpy).toHaveBeenCalledWith('hello', 'en', 'zh');
    });

    it('should call MyMemory with the selected language pair', async () => {
      const app = new OCRApp();
      global.fetch.mockResolvedValueOnce({
        json: vi.fn().mockResolvedValue({
          responseStatus: 200,
          responseData: { translatedText: '你好' }
        })
      });

      const result = await app.translateByMyMemory('hello', 'en', 'zh');

      expect(result).toBe('你好');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('langpair=en|zh')
      );
    });

    it('should update the translation result area', async () => {
      const app = new OCRApp();
      app.resultText = { value: 'hello' };
      app.sourceLangSelect = { value: 'en' };
      app.targetLangSelect = { value: 'zh' };
      app.translateResult = { value: '' };
      app.translateResultArea = { classList: { add: vi.fn() } };
      app.translateBtn = { disabled: false };
      app.showStatus = vi.fn();
      vi.spyOn(app, 'translate').mockResolvedValue('你好');

      await app.translateAndUpdate();

      expect(app.translateResult.value).toBe('你好');
      expect(app.translateResultArea.classList.add).toHaveBeenCalledWith('show');
      expect(app.translateBtn.disabled).toBe(false);
    });
  });
});
