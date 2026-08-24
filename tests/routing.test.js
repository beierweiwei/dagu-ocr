import { describe, expect, it, vi } from 'vitest';
import { OCRApp } from '../plugin/src/ocr.js';

function createApp(options = {}) {
  const store = {
    load: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue(undefined),
    loadHistory: vi.fn().mockReturnValue([]),
    saveHistory: vi.fn(),
    clearHistory: vi.fn()
  };
  return new OCRApp({
    win: { navigator: {}, ...options.win },
    store,
    providerService: {
      config: {},
      builtin: { config: {} },
      invoke: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ ocr: [], translation: [] })
    },
    ...options
  });
}

describe('Plugin entry routing', () => {
  it('starts the screenshot editor flow for the screenshot command', () => {
    const onScreenshotRequest = vi.fn();
    const app = createApp({ onScreenshotRequest });
    app.initElements();

    app.onPluginEnter({ code: 'screenshot' });

    expect(app.state.mode).toBe('edit');
    expect(onScreenshotRequest).toHaveBeenCalledTimes(1);
  });

  it('runs OCR directly for an image payload', () => {
    const app = createApp();
    app.initElements();
    app.processImageUrlAutoExit = vi.fn();

    app.onPluginEnter({ code: 'ocr', type: 'img', payload: 'data:image/png;base64,image' });

    expect(app.state.mode).toBe('ocr');
    expect(app.processImageUrlAutoExit).toHaveBeenCalledWith('data:image/png;base64,image');
  });

  it('opens the image editor for the edit command', () => {
    const onEditRequest = vi.fn();
    const app = createApp({ onEditRequest });
    app.initElements();

    app.onPluginEnter({ code: 'edit-image', type: 'img', payload: 'data:image/png;base64,image' });

    expect(app.state.mode).toBe('edit');
    expect(onEditRequest).toHaveBeenCalledWith(
      'data:image/png;base64,image',
      { returnInput: false }
    );
  });

  it('shows upload when OCR has no clipboard image', async () => {
    const app = createApp();
    app.initElements();
    app.readClipboardImage = vi.fn().mockResolvedValue(null);
    app.showDropArea = vi.fn();

    await app.onPluginEnter({ code: 'ocr' });

    expect(app.readClipboardImage).toHaveBeenCalledTimes(1);
    expect(app.showDropArea).toHaveBeenCalledTimes(1);
  });

  it('opens the configuration panel for the setup command', () => {
    const app = createApp();
    app.initElements();

    app.onPluginEnter({ code: 'setup' });

    expect(app.state.showConfig).toBe(true);
    expect(app.state.showUpload).toBe(true);
  });

  it('shows only text input when translation has no payload', () => {
    const app = createApp();
    app.initElements();

    app.onPluginEnter({ code: 'translate' });

    expect(app.state.showTranslationInput).toBe(true);
    expect(app.state.showUpload).toBe(false);
  });

  it('translates a text payload immediately', () => {
    const app = createApp();
    app.initElements();
    app.translateTextInput = vi.fn();

    app.onPluginEnter({ code: 'translate', type: 'over', payload: 'hello' });

    expect(app.state.translationInput).toBe('hello');
    expect(app.translateTextInput).toHaveBeenCalledTimes(1);
  });

  it('defers plugin entry until initialization completes', () => {
    const app = createApp();
    const param = { code: 'ocr', type: 'img', payload: 'image' };
    app.onPluginEnter(param);

    expect(app.pendingPluginEnter).toEqual(param);

    app.ready = true;
    app.handlePluginEnter = vi.fn();
    app.processPendingPluginEnter();

    expect(app.handlePluginEnter).toHaveBeenCalledWith(param);
    expect(app.pendingPluginEnter).toBeNull();
  });
});
