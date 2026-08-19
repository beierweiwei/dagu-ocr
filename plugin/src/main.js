import './ocr.js';

const win = globalThis.window;
let domLoaded = false;

// ── Annotate flow: stay on index.html, use child window ──
function startAnnotateFlow(param) {
  // If we already have the image, open child window directly
  if (param.type === 'img' && param.payload) {
    openAnnotateChildWindow(param.payload);
    return;
  }

  // Otherwise, trigger screenshot capture
  const hasCaptureApi = !!(
    win?.ztools?.screenCapture || win?.utools?.screenCapture
  );

  if (!hasCaptureApi) {
    // Fallback: file input picker
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.position = 'fixed';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.onchange = function(e) {
      if (e.target.files.length > 0) {
        var reader = new FileReader();
        reader.onload = function(ev) {
          input.remove();
          openAnnotateChildWindow(ev.target.result);
        };
        reader.readAsDataURL(e.target.files[0]);
      }
    };
    document.body.appendChild(input);
    input.click();
    return;
  }

  // Hide main window, trigger screenshot
  if (win?.ztools?.hideMainWindow) win.ztools.hideMainWindow();
  else if (win?.utools) win.utools.hideMainWindow();

  setTimeout(function() {
    var capture = win?.ztools?.screenCapture || win?.utools?.screenCapture;
    capture(function(imageUrl) {
      if (!imageUrl) {
        setTimeout(function() { exitPlugin(); }, 1000);
        return;
      }
      openAnnotateChildWindow(imageUrl);
    });
  }, 300);
}

function openAnnotateChildWindow(imageUrl, returnToInput) {
  if (win?.ztools?.createBrowserWindow) {
    // 先加载图片获取尺寸，再用正确尺寸创建窗口
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      var toolbarHeight = 56;
      var padding = 24;
      var minToolbarWidth = 700;

      var width = img.naturalWidth + padding;
      var height = img.naturalHeight + toolbarHeight + padding;

      var minWindowWidth = minToolbarWidth + padding;
      if (width < minWindowWidth) width = minWindowWidth;

      try {
        var childUrl = new URL('annotate.html', window.location.href).href +
          '?image=' + encodeURIComponent(imageUrl) +
          (returnToInput ? '&returnInput=1' : '');
        var childWin = win.ztools.createBrowserWindow(childUrl, {
          width: width,
          height: height,
          frame: false,
          title: '截图编辑',
          resizable: true,
          webPreferences: {
            preload: 'preload.js'
          }
        });
        childWin.show();
        setTimeout(function() { exitPlugin(); }, 300);
      } catch (e) {
        console.warn('createBrowserWindow failed:', e);
        fallbackRedirect(imageUrl, returnToInput);
      }
    };
    img.onerror = function() {
      try {
        var childUrl = new URL('annotate.html', window.location.href).href +
          '?image=' + encodeURIComponent(imageUrl) +
          (returnToInput ? '&returnInput=1' : '');
        var childWin = win.ztools.createBrowserWindow(childUrl, {
          width: 800,
          height: 600,
          frame: false,
          title: '截图编辑',
          resizable: true,
          webPreferences: {
            preload: 'preload.js'
          }
        });
        childWin.show();
        setTimeout(function() { exitPlugin(); }, 300);
      } catch (e) {
        console.warn('createBrowserWindow failed:', e);
        fallbackRedirect(imageUrl, returnToInput);
      }
    };
    img.src = imageUrl;
    return;
  }

  fallbackRedirect(imageUrl, returnToInput);
}

function fallbackRedirect(imageUrl, returnToInput) {
  var fallbackParams = new URLSearchParams();
  fallbackParams.set('code', 'screenshot-annotate');
  fallbackParams.set('type', 'img');
  fallbackParams.set('payload', imageUrl);
  if (returnToInput) fallbackParams.set('returnInput', '1');
  window.location.href = 'annotate.html?' + fallbackParams.toString();
}

function exitPlugin() {
  if (win?.ztools?.outPlugin) {
    win.ztools.outPlugin(false);
  } else if (win?.utools) {
    win.utools.hideMainWindow();
  }
}

function startTranslateFlow(param) {
  if (!domLoaded || !window.app) {
    win.__ztoolsEnterParam = param;
    return;
  }

  if (param.type === 'img' && param.payload) {
    window.app.autoTranslate = true;
    window.app.processImageUrl(param.payload);
    window.app.recognizeAndUpdate(param.payload);
    return;
  }

  const capture = win?.ztools?.screenCapture || win?.utools?.screenCapture;
  if (typeof capture !== 'function') {
    window.app.autoTranslate = true;
    window.app.showDropArea();
    return;
  }

  if (win?.ztools?.hideMainWindow) win.ztools.hideMainWindow();
  else if (win?.utools) win.utools.hideMainWindow();

  setTimeout(() => {
    capture((imageUrl) => {
      if (!imageUrl) {
        setTimeout(() => exitPlugin(), 1000);
        return;
      }

      if (win?.ztools?.showMainWindow) win.ztools.showMainWindow();
      else if (win?.utools) win.utools.showMainWindow();

      window.app.autoTranslate = true;
      window.app.processImageUrl(imageUrl);
      window.app.recognizeAndUpdate(imageUrl);
    });
  }, 300);
}

function handlePluginEnter(param) {
  if (param.code === 'screenshot-annotate') {
    startAnnotateFlow(param);
    return;
  }

  if (param.code === 'translate') {
    startTranslateFlow(param);
    return;
  }

  if (domLoaded && window.app) {
    window.app.onPluginEnter(param);
  } else {
    win.__ztoolsEnterParam = param;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  domLoaded = true;
  window.app = new OCRApp();
  window.app.initElements();
  window.app.bindEvents();

  // Wire up the static edit button (hidden by default, shown by OCRApp)
  const editBtn = document.getElementById('edit-image-btn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const img = document.getElementById('previewImg');
      if (img && img.src) {
        openAnnotateChildWindow(img.src, true);
      }
    });
  }

  // OCRApp.bindEvents replaces our module-level onPluginEnter handler
  // (ZTools last-registered-wins), so re-register to stay active
  if (win?.ztools && typeof win.ztools.onPluginEnter === 'function') {
    win.ztools.onPluginEnter(handlePluginEnter);
  } else if (win?.utools) {
    win.utools.onPluginEnter(handlePluginEnter);
  }

  if (win.__ztoolsEnterParam) {
    const param = win.__ztoolsEnterParam;
    win.__ztoolsEnterParam = null;
    if (param.code === 'screenshot-annotate') {
      startAnnotateFlow(param);
      return;
    }
    if (param.code === 'translate') {
      startTranslateFlow(param);
      return;
    }
    window.app.pendingPluginEnter = param;
    window.app.processPendingPluginEnter();
  }
});

// 监听来自标注窗口的消息
window.addEventListener('message', (e) => {
  if (e.data.type === 'imageEdited' && e.data.imageUrl) {
    // 标注完成，重新识别编辑后的图片
    if (window.app) {
      window.app.recognizeAndUpdate(e.data.imageUrl);
    }
  }
});

// Top-level handler: capture plugin enter before DOM is ready
if (win?.ztools && typeof win.ztools.onPluginEnter === 'function') {
  win.ztools.onPluginEnter(handlePluginEnter);
} else if (win?.utools) {
  win.utools.onPluginEnter(handlePluginEnter);
}
