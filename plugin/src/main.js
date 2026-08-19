import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';
import { OCRApp } from './ocr.js';

const win = globalThis.window || globalThis;

function hideMainWindow() {
  if (typeof win?.ztools?.hideMainWindow === 'function') win.ztools.hideMainWindow();
  else if (typeof win?.utools?.hideMainWindow === 'function') win.utools.hideMainWindow();
}

function showMainWindow() {
  if (typeof win?.ztools?.showMainWindow === 'function') win.ztools.showMainWindow();
  else if (typeof win?.utools?.showMainWindow === 'function') win.utools.showMainWindow();
}

function editorUrl(imageUrl, options = {}) {
  const url = new URL('annotate.html', window.location.href);
  url.searchParams.set('image', imageUrl);
  url.searchParams.set('payload', imageUrl);
  if (options.fromScreenshot) url.searchParams.set('screenshotFlow', '1');
  if (options.returnInput) url.searchParams.set('returnInput', '1');
  return url.href;
}

function openEditorWindow(imageUrl, options = {}) {
  const url = editorUrl(imageUrl, options);
  const createWindow = win?.ztools?.createBrowserWindow;
  if (typeof createWindow !== 'function') {
    window.location.href = url;
    return;
  }

  const create = (width = 800, height = 600) => {
    try {
      const child = createWindow(url, {
        width,
        height,
        frame: false,
        title: options.fromScreenshot ? '截图编辑' : '图片编辑',
        resizable: true,
        webPreferences: { preload: 'preload.js' }
      });
      child?.show?.();
    } catch (error) {
      console.warn('创建编辑窗口失败:', error);
      window.location.href = url;
    }
  };

  hideMainWindow();
  const image = new Image();
  image.onload = () => create(
    Math.max(Math.min(image.naturalWidth + 24, EDITOR_MAX_WIDTH), EDITOR_MIN_WIDTH),
    Math.max(Math.min(image.naturalHeight + 80, EDITOR_MAX_HEIGHT), EDITOR_MIN_HEIGHT)
  );
  image.onerror = () => create(EDITOR_MIN_WIDTH, EDITOR_MIN_HEIGHT);
  image.src = imageUrl;
}

let controller;

const EDITOR_MIN_WIDTH = 860;
const EDITOR_MIN_HEIGHT = 640;
const EDITOR_MAX_WIDTH = 1280;
const EDITOR_MAX_HEIGHT = 760;

function startScreenshotFlow() {
  hideMainWindow();
  controller.showStatus('正在唤起截图功能...');
  setTimeout(() => {
    controller.captureScreen((imageUrl) => {
      if (!imageUrl) {
        showMainWindow();
        controller.showStatus('已取消截图');
        return;
      }
      openEditorWindow(imageUrl, { fromScreenshot: true });
    });
  }, 300);
}

controller = new OCRApp({
  win,
  onScreenshotRequest: startScreenshotFlow,
  onEditRequest: openEditorWindow
});
win.app = controller;

function handlePluginEnter(param) {
  return controller.onPluginEnter(param);
}

if (win?.ztools && typeof win.ztools.onPluginEnter === 'function') {
  win.ztools.onPluginEnter(handlePluginEnter);
} else if (win?.utools && typeof win.utools.onPluginEnter === 'function') {
  win.utools.onPluginEnter(handlePluginEnter);
}

window.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'annotateAction' && data.imageUrl) {
    showMainWindow();
    void controller.handleEditedImage(data.imageUrl, data.action);
    return;
  }
  if (data.type === 'imageEdited' && data.imageUrl) {
    showMainWindow();
    void controller.handleEditedImage(data.imageUrl, 'ocr');
  }
});

const mount = document.getElementById('app');
if (mount) createApp(App, { controller }).mount(mount);
controller.bindEvents();

async function bootstrap() {
  try {
    await controller.initialize();
    const params = new URLSearchParams(window.location.search);
    const editorAction = params.get('editorAction');
    const editorImage = params.get('image');
    if (editorAction && editorImage) {
      await controller.handleEditedImage(editorImage, editorAction);
      return;
    }

    if (win.__ztoolsEnterParam) {
      const param = win.__ztoolsEnterParam;
      win.__ztoolsEnterParam = null;
      await controller.onPluginEnter(param);
    }
  } catch (error) {
    controller.showStatus(`初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

void bootstrap();
