// 定义为全局类，不需要 export
class OCRApp {
  constructor() {
    this.resultText = { value: '' };
    this.status = { textContent: '' };
    this.preview = null;
    this.previewImg = null;
    this.loading = null;
    this.resultArea = null;
    this.fileInput = null;
    this.dropArea = null;
    this.copyBtn = null;
    this.clearBtn = null;
    this.history = [];
    this.historyExpanded = false;
    // 保存 pending 的 plugin enter 等待 DOM 初始化
    this.pendingPluginEnter = null;
    this.autoTranslate = false;
    // 配置相关
    this.config = {
      baiduAk: '',
      baiduSk: '',
      aliAk: '',
      aliSk: '',
      baiduTranslateAppId: '',
      baiduTranslateSecretKey: '',
      sourceLang: 'auto',
      targetLang: 'zh'
    };
    this.baiduAccessToken = null;
    this.baiduTokenExpireTime = 0;
  }

  initElements() {
    const doc = globalThis.window.document;
    this.dropArea = doc.getElementById('dropArea');
    this.fileInput = doc.getElementById('fileInput');
    this.preview = doc.getElementById('preview');
    this.previewImg = doc.getElementById('previewImg');
    this.loading = doc.getElementById('loading');
    this.resultArea = doc.getElementById('resultArea');
    this.resultText = doc.getElementById('resultText');
    this.copyBtn = doc.getElementById('copyBtn');
    this.clearBtn = doc.getElementById('clearBtn');
    this.confirmBtn = doc.getElementById('confirmBtn');
    this.status = doc.getElementById('status');
    this.historyToggle = doc.getElementById('historyToggle');
    this.historyPanel = doc.getElementById('historyPanel');
    this.historyList = doc.getElementById('historyList');
    this.historyEmpty = doc.getElementById('historyEmpty');
    this.clearHistoryBtn = doc.getElementById('clearHistoryBtn');
    // 配置相关元素
    this.configBtn = doc.getElementById('configBtn');
    this.configPanel = doc.getElementById('configPanel');
    this.closeConfigBtn = doc.getElementById('closeConfigBtn');
    this.saveConfigBtn = doc.getElementById('saveConfigBtn');
    this.testConfigBtn = doc.getElementById('testConfigBtn');
    this.baiduAkInput = doc.getElementById('baiduAk');
    this.baiduSkInput = doc.getElementById('baiduSk');
    this.aliAkInput = doc.getElementById('aliAk');
    this.aliSkInput = doc.getElementById('aliSk');
    this.translateBtn = doc.getElementById('translateBtn');
    this.translateResult = doc.getElementById('translateResult');
    this.translateResultArea = doc.getElementById('translateResultArea');
    this.copyTranslateBtn = doc.getElementById('copyTranslateBtn');
    this.sourceLangSelect = doc.getElementById('sourceLang');
    this.targetLangSelect = doc.getElementById('targetLang');
    this.swapLangBtn = doc.getElementById('swapLangBtn');
    this.targetLangConfigSelect = doc.getElementById('targetLangConfig');
    this.baiduTranslateAppIdInput = doc.getElementById('baiduTranslateAppId');
    this.baiduTranslateSecretKeyInput = doc.getElementById('baiduTranslateSecretKey');
    // 加载配置
    this.loadConfig();
    this.loadHistory();
    this.renderHistory();
  }

  bindEvents() {
    // 先绑定插件进入事件！这个要最先绑定，防止丢失事件
    const win = globalThis.window;
    if (win?.ztools && typeof win.ztools.onPluginEnter === 'function') {
      win.ztools.onPluginEnter((param) => {
        this.onPluginEnter(param);
      });
    } else if (win?.utools) {
      win.utools.onPluginEnter((param) => {
        this.onPluginEnter(param);
      });
    }

    // 拖拽上传
    if (this.dropArea) {
      this.dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.dropArea.classList.add('dragover');
      });

      this.dropArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        this.dropArea.classList.remove('dragover');
      });

      this.dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        this.dropArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFile(files[0]);
        }
      });

      // 点击上传
      this.dropArea.addEventListener('click', () => {
        this.fileInput.click();
      });
    }

    this.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleFile(e.target.files[0]);
      }
    });

    // 粘贴图片
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              this.handleFile(file);
            }
            break;
          }
        }
      }
    });

    // 确认并复制按钮
    this.confirmBtn.addEventListener('click', () => {
      this.confirmResult();
    });

    // 仅复制按钮
    this.copyBtn.addEventListener('click', () => {
      this.copyResult();
    });

    // 清除按钮
    this.clearBtn.addEventListener('click', () => {
      this.clearAll();
    });

    // 快捷键
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (this.resultText && this.resultText.value) {
          this.confirmResult();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        this.clearAll();
      }
    });

    // 配置相关事件
    if (this.configBtn) {
      this.configBtn.addEventListener('click', () => this.showConfigPanel());
    }
    if (this.closeConfigBtn) {
      this.closeConfigBtn.addEventListener('click', () => this.hideConfigPanel());
    }
    if (this.saveConfigBtn) {
      this.saveConfigBtn.addEventListener('click', () => this.saveConfig());
    }
    if (this.testConfigBtn) {
      this.testConfigBtn.addEventListener('click', () => this.testConfig());
    }
    if (this.translateBtn) {
      this.translateBtn.addEventListener('click', () => this.translateAndUpdate());
    }
    if (this.swapLangBtn) {
      this.swapLangBtn.addEventListener('click', () => this.swapLanguages());
    }
    if (this.copyTranslateBtn) {
      this.copyTranslateBtn.addEventListener('click', () => this.copyTranslateResult());
    }
    if (this.sourceLangSelect) {
      this.sourceLangSelect.addEventListener('change', () => {
        this.config.sourceLang = this.sourceLangSelect.value;
        this.saveLangConfig();
      });
    }
    if (this.targetLangSelect) {
      this.targetLangSelect.addEventListener('change', () => {
        this.config.targetLang = this.targetLangSelect.value;
        if (this.targetLangConfigSelect) {
          this.targetLangConfigSelect.value = this.targetLangSelect.value;
        }
        this.saveLangConfig();
      });
    }
    if (this.targetLangConfigSelect) {
      this.targetLangConfigSelect.addEventListener('change', () => {
        this.config.targetLang = this.targetLangConfigSelect.value;
        if (this.targetLangSelect) {
          this.targetLangSelect.value = this.config.targetLang;
        }
        this.saveLangConfig();
      });
    }
    if (this.historyToggle) {
      this.historyToggle.addEventListener('click', () => this.toggleHistory());
    }
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    }
  }

  // 处理等待中的 plugin enter（DOM 就绪后执行）
  processPendingPluginEnter() {
    if (this.pendingPluginEnter) {
      const param = this.pendingPluginEnter;
      this.pendingPluginEnter = null;
      this.handlePluginEnter(param);
    }
  }

  async initTesseract() {
    // 现在优先使用用户配置的在线OCR，不需要本地引擎
    return true;
  }

  // ========== 配置相关方法 ==========
  loadConfig() {
    try {
      const saved = localStorage.getItem('ocr_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
        // 把值填到输入框
        if (this.baiduAkInput) this.baiduAkInput.value = this.config.baiduAk || '';
        if (this.baiduSkInput) this.baiduSkInput.value = this.config.baiduSk || '';
        if (this.aliAkInput) this.aliAkInput.value = this.config.aliAk || '';
        if (this.aliSkInput) this.aliSkInput.value = this.config.aliSk || '';
        if (this.baiduTranslateAppIdInput) this.baiduTranslateAppIdInput.value = this.config.baiduTranslateAppId || '';
        if (this.baiduTranslateSecretKeyInput) this.baiduTranslateSecretKeyInput.value = this.config.baiduTranslateSecretKey || '';
        if (this.sourceLangSelect) this.sourceLangSelect.value = this.config.sourceLang || 'auto';
        if (this.targetLangSelect) this.targetLangSelect.value = this.config.targetLang || 'zh';
        if (this.targetLangConfigSelect) this.targetLangConfigSelect.value = this.config.targetLang || 'zh';
      }
    } catch (e) {
      console.error('加载配置失败:', e);
    }
  }

  saveLangConfig() {
    try {
      localStorage.setItem('ocr_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('保存语言配置失败:', e);
    }
  }

  saveConfig(autoClose = true) {
    // 从输入框获取值
    this.config.baiduAk = (this.baiduAkInput?.value || '').trim();
    this.config.baiduSk = (this.baiduSkInput?.value || '').trim();
    this.config.aliAk = (this.aliAkInput?.value || '').trim();
    this.config.aliSk = (this.aliSkInput?.value || '').trim();
    this.config.baiduTranslateAppId = (this.baiduTranslateAppIdInput?.value || '').trim();
    this.config.baiduTranslateSecretKey = (this.baiduTranslateSecretKeyInput?.value || '').trim();
    this.config.sourceLang = this.sourceLangSelect?.value || this.config.sourceLang || 'auto';
    this.config.targetLang = this.targetLangConfigSelect?.value || this.targetLangSelect?.value || this.config.targetLang || 'zh';

    // 保存到localStorage
    try {
      localStorage.setItem('ocr_config', JSON.stringify(this.config));
      this.showStatus('✅ 配置保存成功');
      // 清除旧的百度token
      this.baiduAccessToken = null;
      this.baiduTokenExpireTime = 0;
      // 保存成功后自动关闭配置面板（可选）
      if (autoClose) {
        this.hideConfigPanel();
      }
    } catch (e) {
      console.error('保存配置失败:', e);
      this.showStatus('❌ 配置保存失败');
      if (autoClose) {
        this.hideConfigPanel();
      }
    }
  }

  loadHistory() {
    try {
      const saved = globalThis.localStorage?.getItem('ocr_history');
      const parsed = saved ? JSON.parse(saved) : [];
      this.history = Array.isArray(parsed)
        ? parsed.filter(item => item && typeof item.text === 'string').slice(0, 50)
        : [];
    } catch (e) {
      console.error('加载历史记录失败:', e);
      this.history = [];
    }
  }

  saveHistory(text) {
    const normalized = text.trim();
    if (!normalized) return false;

    this.history = [
      { text: normalized, timestamp: Date.now() },
      ...this.history.filter(item => item.text !== normalized),
    ].slice(0, 50);

    try {
      globalThis.localStorage?.setItem('ocr_history', JSON.stringify(this.history));
    } catch (e) {
      console.error('保存历史记录失败:', e);
    }
    return true;
  }

  renderHistory() {
    if (!this.historyList) return;

    this.historyList.innerHTML = '';
    const doc = globalThis.window?.document;
    for (const item of this.history) {
      const button = doc?.createElement?.('button');
      if (!button) continue;
      button.type = 'button';
      button.className = 'history-item';
      button.textContent = item.text;
      button.addEventListener('click', () => {
        if (this.copyResultText(item.text)) {
          this.showStatus('已复制到剪贴板');
        } else {
          this.showStatus('复制失败');
        }
      });
      this.historyList.appendChild(button);
    }

    if (this.historyEmpty?.style) {
      this.historyEmpty.style.display = this.history.length ? 'none' : 'block';
    }
  }

  toggleHistory() {
    this.historyExpanded = !this.historyExpanded;
    this.historyPanel?.classList.toggle('show', this.historyExpanded);
    this.historyToggle?.setAttribute('aria-expanded', String(this.historyExpanded));
    if (this.historyToggle) {
      this.historyToggle.textContent = this.historyExpanded ? '隐藏历史' : '显示历史';
    }
  }

  clearHistory() {
    this.history = [];
    try {
      globalThis.localStorage?.removeItem?.('ocr_history');
    } catch (e) {
      console.error('清空历史记录失败:', e);
    }
    this.renderHistory();
    this.showStatus('历史记录已清空');
  }

  showConfigPanel() {
    if (this.configPanel) {
      this.configPanel.style.display = 'block';
    }
  }

  hideConfigPanel() {
    if (this.configPanel) {
      this.configPanel.style.display = 'none';
    }
  }

  async testConfig() {
    this.showStatus('🧪 正在测试配置...');
    // 先保存当前输入的配置，不自动关闭面板
    this.saveConfig(false);
    try {
      // 用一张空白测试图测试
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      const text = await this.recognize(testImage);
      this.showStatus('✅ 配置测试成功！');
      // 测试成功后延迟1秒关闭面板，让用户看到成功消息
      setTimeout(() => {
        this.hideConfigPanel();
      }, 1000);
    } catch (e) {
      // 配置测试只验证密钥有效性，只要不是认证/密钥错误就算成功
      const errorMsg = e.message.toLowerCase();
      // 判断是否是密钥/认证相关的错误（使用更精确的匹配避免误判）
      const isAuthError = errorMsg.includes('token获取失败') ||
                         errorMsg.includes('invalid client') ||
                         errorMsg.includes('认证失败') ||
                         errorMsg.includes('invalidaccesskeyid') ||
                         errorMsg.includes('signaturedoesnotmatch') ||
                         errorMsg.includes('access key id') ||
                         errorMsg.includes('secret key') ||
                         errorMsg.includes('密钥错误') ||
                         errorMsg.includes('权限不足') ||
                         errorMsg.includes('未开通服务') ||
                         errorMsg.includes('apikey无效') ||
                         errorMsg.includes('invalid api key') ||
                         errorMsg.includes('鉴权失败');

      if (isAuthError) {
        this.showStatus(`❌ 配置测试失败: ${e.message.slice(0, 30)}`);
        // 测试失败不关闭面板，让用户修改配置
      } else {
        // 其他错误（比如图片识别不出文字）不影响配置验证，认为配置成功
        this.showStatus('✅ 配置测试成功！');
        setTimeout(() => {
          this.hideConfigPanel();
        }, 1000);
      }
    }
  }

  // ========== 百度OCR相关方法 ==========
  // 使用XMLHttpRequest发送请求，兼容Electron环境跨域
  sendPost(url, body) {
    const XMLHttpRequestImpl = globalThis.XMLHttpRequest;
    if (!XMLHttpRequestImpl && typeof globalThis.fetch === 'function') {
      return globalThis.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }).then(async (response) => {
        if (response.ok === false) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json();
      });
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequestImpl();
      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error(`解析响应失败: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      };
      xhr.onerror = () => {
        reject(new Error('网络请求失败，请检查网络连接'));
      };
      xhr.ontimeout = () => {
        reject(new Error('请求超时'));
      };
      xhr.timeout = 30000; // 30秒超时
      xhr.send(body);
    });
  }

  async getBaiduAccessToken() {
    if (!this.config.baiduAk || !this.config.baiduSk) {
      throw new Error('请先配置百度OCR密钥');
    }
    // 如果token还没过期，直接返回
    const now = Date.now();
    if (this.baiduAccessToken && now < this.baiduTokenExpireTime) {
      return this.baiduAccessToken;
    }
    // 获取新的token
    try {
      const body = `grant_type=client_credentials&client_id=${this.config.baiduAk}&client_secret=${this.config.baiduSk}`;
      const data = await this.sendPost('https://aip.baidubce.com/oauth/2.0/token', body);
      if (data.error) {
        throw new Error(`百度Token获取失败: ${data.error_description || data.error}`);
      }
      this.baiduAccessToken = data.access_token;
      this.baiduTokenExpireTime = now + (data.expires_in - 60) * 1000; // 提前1分钟过期
      return this.baiduAccessToken;
    } catch (e) {
      throw new Error(`获取百度Token失败: ${e.message}`);
    }
  }

  async recognizeByBaidu(imageUrl) {
    const token = await this.getBaiduAccessToken();
    const base64 = imageUrl.split(',')[1];
    const body = `image=${encodeURIComponent(base64)}&language_type=CHN_ENG`;
    const data = await this.sendPost(`https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic?access_token=${token}`, body);
    if (data.error_code) {
      throw new Error(`百度识别失败: ${data.error_msg}`);
    }
    // 合并识别结果
    if (!data.words_result || !Array.isArray(data.words_result)) {
      return '';
    }
    return data.words_result.map(item => item.words).join('\n').trim();
  }

  // ========== 阿里云OCR相关方法 ==========
  // 官方原生OCR，使用AccessKey ID + AccessKey Secret认证
  async recognizeByAli(imageUrl) {
    if (!this.config.aliAk || !this.config.aliSk) {
      throw new Error('请先配置阿里云OCR AccessKey');
    }

    // 处理图片：base64解码为二进制
    const base64 = imageUrl.split(',')[1];
    // base64转Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 阿里云OCR官方API端点（通用文字识别）
    const endpoint = 'https://ocr-api.cn-hangzhou.aliyuncs.com/';
    const action = 'RecognizeGeneral';
    const version = '2021-07-07';

    // 构建请求参数 - 必须包含所有公共参数在签名里，图片作为body传输
    const params = {
      AccessKeyId: this.config.aliAk,
      Action: action,
      Format: 'JSON',
      RegionId: 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      SignatureVersion: '1.0',
      Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), // 精确到秒，UTC时间
      Version: version
    };

    // 生成签名（异步调用原生API）
    const signature = await this.generateAliyunSignature(params, this.config.aliSk);
    params.Signature = signature;

    // 构建查询字符串
    const queryString = Object.keys(params).sort().map(key => {
      return this.encodeUriComponent(key) + '=' + this.encodeUriComponent(params[key]);
    }).join('&');

    const requestUrl = endpoint + '?' + queryString;

    // 阿里云官方API要求图片放在POST的body里，参数都放在query中
    const res = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream'
      },
      body: bytes // 二进制图片数据
    });

    const data = await res.json();
    if (data.Code && data.Code !== 'Success') {
      throw new Error(`阿里云识别失败: ${data.Message}`);
    }

    // 合并识别结果
    if (!data.Data) {
      return '';
    }
    // 官方返回的Data是JSON字符串，需要解析
    try {
      const result = JSON.parse(data.Data);
      if (result.prism_wordsInfo && Array.isArray(result.prism_wordsInfo)) {
        return result.prism_wordsInfo.map(item => item.word).join('\n').trim();
      }
      return result.content || '';
    } catch (e) {
      console.warn('解析阿里云返回数据失败:', e);
      return data.Data || '';
    }
  }

  // 阿里云规范的URL编码，严格遵循RFC 3986
  encodeUriComponent(str) {
    return encodeURIComponent(str)
      .replace(/!/g, '%21')
      .replace(/'/g, '%27')
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/\*/g, '%2A')
      .replace(/%7E/g, '~'); // 波浪号不编码
  }

  // 生成阿里云API签名（HMAC-SHA1）使用浏览器原生API，更准确可靠
  async generateAliyunSignature(params, secret) {
    // 参数按字典序排序
    const sortedKeys = Object.keys(params).sort();
    // 构建签名字符串
    let queryString = '';
    sortedKeys.forEach(key => {
      queryString += '&' + this.encodeUriComponent(key) + '=' + this.encodeUriComponent(params[key]);
    });
    // 去掉第一个&
    queryString = queryString.substring(1);
    // 按照阿里云规则，构造待签名字符串
    const stringToSign = 'POST&%2F&' + this.encodeUriComponent(queryString);

    // 使用浏览器原生Web Crypto API计算签名
    const encoder = new TextEncoder('utf-8');
    const keyData = encoder.encode(secret + '&');
    const signatureData = encoder.encode(stringToSign);

    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, signatureData);

    // ArrayBuffer转base64
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }


  // ========== 主识别方法，优先用用户配置的OCR ==========
  async recognize(imageUrl) {
    // 优先使用百度OCR（如果配置了）
    if (this.config.baiduAk && this.config.baiduSk) {
      try {
        console.log('使用百度OCR识别...');
        return await this.recognizeByBaidu(imageUrl);
      } catch (e) {
        console.error('百度OCR识别失败，尝试阿里云OCR:', e);
        // 百度失败后尝试阿里云
        if (this.config.aliAk) {
          try {
            console.log('使用阿里云OCR识别...');
            return await this.recognizeByAli(imageUrl);
          } catch (aliError) {
            console.error('阿里云OCR识别也失败:', aliError);
            throw new Error(`百度识别失败: ${e.message}，阿里云识别失败: ${aliError.message}`);
          }
        }
        throw e;
      }
    }

    // 其次使用阿里云OCR（如果配置了）
    if (this.config.aliAk) {
      try {
        console.log('使用阿里云OCR识别...');
        return await this.recognizeByAli(imageUrl);
      } catch (e) {
        console.error('阿里云OCR识别失败:', e);
        throw e;
      }
    }

    // 没有配置任何OCR，提示用户
    throw new Error('请先在配置页面填写百度OCR密钥或阿里云OCR AccessKey');
  }

  onPluginEnter(param) {
    // 如果 DOM 还没初始化，先保存等待
    if (!this.preview && !this.dropArea) {
      this.pendingPluginEnter = param;
      return;
    }
    this.handlePluginEnter(param);
  }

  handlePluginEnter({ code, type, payload }) {
    if (code === 'translate') {
      this.autoTranslate = true;
    }

    // 兼容 ZTools 从外部传入图片（右键菜单等）
    if (type === 'img' && payload) {
      this.processImageUrl(payload);
      this.recognizeAndUpdate(payload);
      return;
    }

    if (code === 'screenshot-ocr') {
      // 截图OCR：直接触发截图，识别完成后自动退出
      this.handleScreenshotOCR();
    } else if (code === 'ocr') {
      // OCR主入口：先检查剪贴板是否有图片，有就直接识别，否则显示界面
      this.handleOCRMain();
    } else if (code === 'translate') {
      // 翻译入口没有图片时复用 OCR 主流程，识别完成后自动翻译
      this.handleOCRMain();
    }
  }

  // 截图OCR处理流程
  async handleScreenshotOCR() {
    const win = globalThis.window;

    // 先隐藏插件窗口，避免遮挡截图区域和冲突
    if (win?.ztools && typeof win.ztools.hideMainWindow === 'function') {
      win.ztools.hideMainWindow();
    } else if (win?.utools) {
      win.utools.hideMainWindow();
    }

    this.showStatus('正在唤起截图功能...');

    // 延迟一点时间调用截图，确保窗口完全隐藏
    setTimeout(() => {
      this.captureScreen((imageUrl) => {
        if (!imageUrl) {
          // 用户取消截图，退出
          this.showStatus('已取消截图');
          setTimeout(() => this.exitPlugin(), 1000);
          return;
        }

        // 用户已经完成截图，显示主窗口展示识别过程
        if (win?.ztools && typeof win.ztools.showMainWindow === 'function') {
          win.ztools.showMainWindow();
        } else if (win?.utools) {
          win.utools.showMainWindow();
        }

        // 显示预览
        this.processImageUrl(imageUrl);
        // 开始识别
        this.recognizeAndUpdateAutoExit(imageUrl);
      });
    }, 300);
  }

  // OCR主入口处理流程
  async handleOCRMain() {
    // 尝试读取剪贴板图片
    const imageUrl = await this.readClipboardImage();
    if (imageUrl) {
      this.processImageUrlAutoExit(imageUrl);
      return;
    }

    // 剪贴板没有图片，显示界面让用户拖拽/粘贴
    this.showDropArea();
    this.renderHistory();
  }

  // 读取剪贴板图片
  async readClipboardImage() {
    try {
      const win = globalThis.window;
      if (!win.navigator?.clipboard?.read) {
        return null;
      }
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          return URL.createObjectURL(blob);
        }
      }
      return null;
    } catch (e) {
      // 读取剪贴板失败（权限问题等），返回 null 让用户手动上传
      console.warn('读取剪贴板失败:', e);
      return null;
    }
  }

  captureScreen(callback) {
    const win = globalThis.window;
    if (win?.ztools && typeof win.ztools.screenCapture === 'function') {
      win.ztools.screenCapture(callback);
    } else if (win?.utools && typeof win.utools.screenCapture === 'function') {
      win.utools.screenCapture(callback);
    } else {
      // 没有截图API，降级显示界面
      this.showStatus('当前环境不支持截图功能');
      this.showDropArea();
    }
  }

  // 处理图片并自动退出（用于截图和剪贴板识别）
  processImageUrlAutoExit(url) {
    this.processImageUrl(url);
    this.recognizeAndUpdateAutoExit(url);
  }

  processImageUrl(url) {
    if (this.previewImg && this.preview) {
      // 先清空之前的事件监听
      this.previewImg.onload = null;
      this.previewImg.onerror = null;

      // 监听加载完成事件
      this.previewImg.onload = () => {
        this.preview.classList.add('show');
      };

      // 监听加载错误事件
      this.previewImg.onerror = () => {
        this.showStatus('❌ 图片加载失败');
      };

      // 设置图片src
      this.previewImg.src = url;
      // 图片上传后即使尚未配置OCR，也应允许用户进入图片编辑流程。
      this.resultArea.classList.add('show');
      this.showEditButton();
    }
  }

  // 带自动退出的识别
  async recognizeAndUpdateAutoExit(imageUrl) {
    if (this.loading && this.loading.classList) {
      this.loading.classList.add('show');
    }

    // 检查有没有配置密钥
    if ((!this.config.baiduAk || !this.config.baiduSk) && !this.config.aliAk) {
      this.showStatus('⚠️ 请先配置OCR密钥');
      this.showConfigPanel();
      if (this.loading && this.loading.classList) {
        this.loading.classList.remove('show');
      }
      return;
    }

    this.showStatus('正在识别...');

    try {
      const text = await this.recognize(imageUrl);

      // 无论是否识别到文字，都显示编辑界面，让用户可以手动输入或修改
      if (this.resultText) {
        this.resultText.value = text || '';
      }
      if (this.resultArea && this.resultArea.classList) {
        this.resultArea.classList.add('show');
      }
      // 显示编辑图片按钮
      this.showEditButton();

      // 自动聚焦到编辑框，方便用户直接编辑
      setTimeout(() => {
        this.resultText?.focus();
      }, 100);

      if (!text || !text.trim()) {
        this.autoTranslate = false;
        this.showStatus('⚠️ 未识别出文字，请手动输入');
        return;
      }

      if (this.autoTranslate) {
        this.autoTranslate = false;
        this.showStatus('');
        void this.translateAndUpdate();
      } else {
        this.showStatus('✅ 识别完成，请编辑确认');
      }
    } catch (error) {
      console.error('识别失败:', error);
      this.showStatus('识别失败: ' + error.message);
    } finally {
      if (this.loading && this.loading.classList) {
        this.loading.classList.remove('show');
      }
    }
  }

  // 常规识别
  async recognizeAndUpdate(imageUrl) {
    if (this.loading && this.loading.classList) {
      this.loading.classList.add('show');
    }

    // 检查有没有配置密钥
    if ((!this.config.baiduAk || !this.config.baiduSk) && !this.config.aliAk) {
      this.showStatus('⚠️ 请先配置OCR密钥');
      this.showConfigPanel();
      if (this.loading && this.loading.classList) {
        this.loading.classList.remove('show');
      }
      return;
    }

    this.showStatus('正在识别...');

    try {
      const text = await this.recognize(imageUrl);
      if (this.resultText) {
        this.resultText.value = text || '';
      }
      if (this.resultArea && this.resultArea.classList) {
        this.resultArea.classList.add('show');
      }
      this.showEditButton();

      if (!text || !text.trim()) {
        this.autoTranslate = false;
        this.showStatus('⚠️ 未识别出文字，请手动输入');
      } else {
        if (this.autoTranslate) {
          this.autoTranslate = false;
          this.showStatus('');
          void this.translateAndUpdate();
        } else {
          this.showStatus('✅ 识别完成，请编辑确认');
        }
      }

      // 自动聚焦到编辑框，方便用户直接编辑
      setTimeout(() => {
        this.resultText?.focus();
      }, 100);
    } catch (error) {
      console.error('识别失败:', error);
      this.showStatus('识别失败: ' + error.message);
    } finally {
      if (this.loading && this.loading.classList) {
        this.loading.classList.remove('show');
      }
    }
  }

  copyResultText(text) {
    const win = globalThis.window;
    if (win?.ztools && typeof win.ztools.copyText === 'function') {
      return win.ztools.copyText(text);
    }
    if (win?.utools && typeof win.utools.copyText === 'function') {
      return win.utools.copyText(text);
    }

    if (globalThis.navigator && globalThis.navigator.clipboard && globalThis.navigator.clipboard.writeText) {
      globalThis.navigator.clipboard.writeText(text).catch(() => {});
      return true;
    }

    try {
      const doc = globalThis.window.document;
      const textarea = doc.createElement('textarea');
      textarea.value = text;
      doc.body.appendChild(textarea);
      textarea.select();
      const success = doc.execCommand('copy');
      doc.body.removeChild(textarea);
      return success;
    } catch (error) {
      return false;
    }
  }

  copyResult() {
    const text = this.resultText.value.trim();
    if (!text) {
      this.showStatus('没有可复制的内容');
      return false;
    }

    const success = this.copyResultText(text);
    if (success) {
      this.showStatus('已复制到剪贴板');
    } else {
      this.showStatus('复制失败');
    }
    return success;
  }

  copyTranslateResult() {
    const text = this.translateResult?.value?.trim();
    if (!text) {
      this.showStatus('没有可复制的翻译内容');
      return false;
    }

    const success = this.copyResultText(text);
    this.showStatus(success ? '翻译内容已复制到剪贴板' : '复制失败');
    return success;
  }

  // 确认结果：复制 + 退出
  confirmResult() {
    const text = this.resultText.value.trim();
    if (!text) {
      this.showStatus('没有可复制的内容');
      return false;
    }

    const success = this.copyResultText(text);
    if (success) {
      this.saveHistory(text);
      this.renderHistory();
      this.showStatus('✅ 已复制到剪贴板，即将退出...');
      setTimeout(() => {
        this.exitPlugin();
      }, 800);
    } else {
      this.showStatus('❌ 复制失败，请手动复制');
    }
    return success;
  }

  // ========== 翻译相关方法 ==========

  detectLanguage(text) {
    if (!text) return 'auto';
    const chineseChars = text.match(/[一-鿿㐀-䶿]/g) || [];
    const japaneseChars = text.match(/[぀-ゟ゠-ヿ]/g) || [];
    if (chineseChars.length / text.length > 0.15) return 'zh';
    if (japaneseChars.length / text.length > 0.1) return 'ja';
    return 'en';
  }

  async translateByMyMemory(text, fromLang, toLang) {
    const langPair = `${fromLang === 'auto' ? 'zh' : fromLang}|${toLang}`;
    const maxLength = 480;
    const chunks = [];
    let current = '';

    for (const line of text.split('\n')) {
      if ((current + '\n' + line).length > maxLength && current) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? `${current}\n${line}` : line;
      }
    }
    if (current) chunks.push(current);

    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('当前环境不支持网络请求');
    }

    const results = [];
    for (const chunk of chunks) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${langPair}`;
      const response = await fetchImpl(url);
      if (response.ok === false) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.responseStatus === 200 && data.responseData) {
        results.push(data.responseData.translatedText);
      } else {
        throw new Error(data.responseDetails || 'MyMemory 翻译失败');
      }
    }
    return results.join('\n');
  }

  async translateByAli(text, fromLang, toLang) {
    if (!this.config.aliAk || !this.config.aliSk) {
      throw new Error('请先配置阿里云 AccessKey');
    }

    const sourceLang = fromLang === 'auto' ? this.detectLanguage(text) : fromLang;
    const params = {
      AccessKeyId: this.config.aliAk,
      Action: 'TranslateGeneral',
      Format: 'JSON',
      RegionId: 'cn-hangzhou',
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      SignatureVersion: '1.0',
      SourceLanguage: sourceLang,
      SourceText: text,
      TargetLanguage: toLang,
      Timestamp: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
      Version: '2018-10-12'
    };

    const signature = await this.generateAliyunSignature(params, this.config.aliSk);
    params.Signature = signature;
    const queryString = Object.keys(params).sort().map((key) => {
      return `${this.encodeUriComponent(key)}=${this.encodeUriComponent(params[key])}`;
    }).join('&');

    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('当前环境不支持网络请求');
    }
    const response = await fetchImpl(`https://mt.cn-hangzhou.aliyuncs.com/?${queryString}`, { method: 'POST' });
    if (response.ok === false) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.Code && data.Code !== '200') {
      throw new Error(data.Message || '阿里云翻译失败');
    }
    return data.Data?.Translated || '';
  }

  async translateByBaidu(text, fromLang, toLang) {
    if (!this.config.baiduTranslateAppId || !this.config.baiduTranslateSecretKey) {
      throw new Error('请先配置百度翻译密钥');
    }

    const salt = Date.now().toString();
    const sign = this.md5(this.config.baiduTranslateAppId + text + salt + this.config.baiduTranslateSecretKey);
    const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(text)}&from=${fromLang}&to=${toLang}&appid=${this.config.baiduTranslateAppId}&salt=${salt}&sign=${sign}`;
    const fetchImpl = globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new Error('当前环境不支持网络请求');
    }

    const response = await fetchImpl(url);
    if (response.ok === false) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.error_code) {
      throw new Error(result.error_msg || '百度翻译失败');
    }
    if (Array.isArray(result.trans_result)) {
      return result.trans_result.map((item) => item.dst).join('\n');
    }
    throw new Error('百度翻译返回格式异常');
  }

  md5(value) {
    const Encoder = globalThis.TextEncoder;
    if (typeof Encoder !== 'function') {
      throw new Error('当前环境不支持文本编码');
    }

    const bytes = new Encoder().encode(value);
    const totalLength = ((bytes.length + 9 + 63) >> 6) << 6;
    const message = new Uint8Array(totalLength);
    message.set(bytes);
    message[bytes.length] = 0x80;

    const view = new DataView(message.buffer);
    const bitLength = bytes.length * 8;
    view.setUint32(totalLength - 8, bitLength >>> 0, true);
    view.setUint32(totalLength - 4, Math.floor(bitLength / 0x100000000), true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const shifts = [
      7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
      5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
      4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
      6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];
    const constants = Array.from({ length: 64 }, (_, index) => (
      Math.floor(Math.abs(Math.sin(index + 1)) * 0x100000000) >>> 0
    ));
    const rotateLeft = (number, amount) => (number << amount) | (number >>> (32 - amount));

    for (let offset = 0; offset < totalLength; offset += 64) {
      const words = Array.from({ length: 16 }, (_, index) => view.getUint32(offset + index * 4, true));
      let a = a0;
      let b = b0;
      let c = c0;
      let d = d0;

      for (let index = 0; index < 64; index += 1) {
        let functionValue;
        let wordIndex;
        if (index < 16) {
          functionValue = (b & c) | (~b & d);
          wordIndex = index;
        } else if (index < 32) {
          functionValue = (d & b) | (~d & c);
          wordIndex = (5 * index + 1) % 16;
        } else if (index < 48) {
          functionValue = b ^ c ^ d;
          wordIndex = (3 * index + 5) % 16;
        } else {
          functionValue = c ^ (b | ~d);
          wordIndex = (7 * index) % 16;
        }

        const sum = (a + functionValue + constants[index] + words[wordIndex]) | 0;
        const next = (b + rotateLeft(sum, shifts[index])) | 0;
        a = d;
        d = c;
        c = b;
        b = next;
      }

      a0 = (a0 + a) | 0;
      b0 = (b0 + b) | 0;
      c0 = (c0 + c) | 0;
      d0 = (d0 + d) | 0;
    }

    return [a0, b0, c0, d0].map((number) => {
      const unsigned = number >>> 0;
      return [0, 8, 16, 24].map((shift) => ((unsigned >>> shift) & 0xff).toString(16).padStart(2, '0')).join('');
    }).join('');
  }

  async translate(text, fromLang, toLang) {
    if (!text || !text.trim()) {
      throw new Error('没有可翻译的内容');
    }

    const resolvedFrom = fromLang === 'auto' ? this.detectLanguage(text) : fromLang;
    if (resolvedFrom === toLang) {
      return text;
    }

    if (this.config.baiduTranslateAppId && this.config.baiduTranslateSecretKey) {
      try {
        console.log('使用百度翻译...');
        return await this.translateByBaidu(text, resolvedFrom, toLang);
      } catch (error) {
        console.error('百度翻译失败，尝试阿里云:', error);
      }
    }

    if (this.config.aliAk && this.config.aliSk) {
      try {
        console.log('使用阿里云翻译...');
        return await this.translateByAli(text, resolvedFrom, toLang);
      } catch (error) {
        console.error('阿里云翻译失败，尝试 MyMemory:', error);
      }
    }

    try {
      console.log('使用 MyMemory 翻译...');
      return await this.translateByMyMemory(text, resolvedFrom, toLang);
    } catch (error) {
      console.error('MyMemory 翻译失败:', error);
      throw new Error('翻译失败: ' + error.message);
    }
  }

  async translateAndUpdate() {
    const text = this.resultText?.value?.trim();
    if (!text) {
      this.showStatus('没有可翻译的内容');
      return;
    }

    const fromLang = this.sourceLangSelect?.value || this.config.sourceLang || 'auto';
    const toLang = this.targetLangSelect?.value || this.config.targetLang || 'zh';
    this.showStatus('正在翻译...');
    if (this.translateBtn) this.translateBtn.disabled = true;

    try {
      const translated = await this.translate(text, fromLang, toLang);
      if (this.translateResult) {
        this.translateResult.value = translated || '';
      }
      if (this.translateResultArea?.classList) {
        this.translateResultArea.classList.add('show');
      }
      this.showStatus('');
    } catch (error) {
      console.error('翻译失败:', error);
      this.showStatus('翻译失败: ' + error.message);
    } finally {
      if (this.translateBtn) this.translateBtn.disabled = false;
    }
  }

  swapLanguages() {
    const sourceSelect = this.sourceLangSelect;
    const targetSelect = this.targetLangSelect;
    if (!sourceSelect || !targetSelect || sourceSelect.value === 'auto') return;

    const sourceValue = sourceSelect.value;
    sourceSelect.value = targetSelect.value;
    targetSelect.value = sourceValue;
    this.config.sourceLang = sourceSelect.value;
    this.config.targetLang = targetSelect.value;
    if (this.targetLangConfigSelect) {
      this.targetLangConfigSelect.value = this.config.targetLang;
    }
    this.saveLangConfig();
  }

  showEditButton() {
    const btn = document.getElementById('edit-image-btn');
    if (btn) btn.style.display = '';
  }

  hideEditButton() {
    const btn = document.getElementById('edit-image-btn');
    if (btn) btn.style.display = 'none';
  }

  showStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
  }

  // 显示确认弹窗
  showConfirmDialog(message, callback) {
    // 先移除已存在的弹窗
    const existingDialog = document.querySelector('.custom-dialog-overlay');
    if (existingDialog) {
      existingDialog.remove();
    }

    const overlay = document.createElement('div');
    overlay.className = 'custom-dialog-overlay';

    overlay.innerHTML = `
      <div class="custom-dialog">
        <div class="custom-dialog-title">${message}</div>
        <div class="custom-dialog-actions">
          <button class="custom-dialog-btn" id="dialog-cancel">取消</button>
          <button class="custom-dialog-btn danger" id="dialog-confirm">确定</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelBtn = overlay.querySelector('#dialog-cancel');
    const confirmBtn = overlay.querySelector('#dialog-confirm');

    // 取消按钮
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
      callback(false);
    });

    // 确定按钮
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      callback(true);
    });

    // 回车确认
    const onKeyDown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click();
        document.removeEventListener('keydown', onKeyDown);
      } else if (e.key === 'Escape') {
        cancelBtn.click();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    // 点击遮罩取消
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cancelBtn.click();
      }
    });
  }

  handleFile(file) {
    if (!file.type.startsWith('image/')) {
      this.showStatus('请选择图片文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.processImageUrl(e.target.result);
      this.recognizeAndUpdate(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  clearAll() {
    if (this.fileInput) {
      this.fileInput.value = '';
    }
    if (this.resultText) {
      this.resultText.value = '';
    }
    if (this.previewImg) {
      this.previewImg.src = '';
    }
    if (this.preview && this.preview.classList) {
      this.preview.classList.remove('show');
    }
    if (this.resultArea && this.resultArea.classList) {
      this.resultArea.classList.remove('show');
    }
    if (this.translateResult) {
      this.translateResult.value = '';
    }
    if (this.translateResultArea && this.translateResultArea.classList) {
      this.translateResultArea.classList.remove('show');
    }
    this.autoTranslate = false;
    this.hideEditButton();
    this.showStatus('');
  }

  showDropArea() {
    if (this.dropArea && this.dropArea.classList) {
      this.dropArea.classList.add('show');
    }
  }

  // 退出插件
  exitPlugin() {
    const win = globalThis.window;
    if (win?.ztools && typeof win.ztools.outPlugin === 'function') {
      win.ztools.outPlugin(false);
    } else if (win?.utools) {
      win.utools.hideMainWindow();
    }
    // ZTools 退出后会自动隐藏，不需要额外操作
  }
}

// 暴露到全局
if (typeof window !== 'undefined') {
  window.OCRApp = OCRApp;
}

// ES模块导出（用于测试）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OCRApp };
}
