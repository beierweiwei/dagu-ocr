import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRApp } from '../plugin/src/ocr';

describe('Copy Functionality', () => {
  beforeEach(() => {
    global.Tesseract = {
      createWorker: vi.fn().mockResolvedValue({
        loadLanguage: vi.fn().mockResolvedValue(),
        initialize: vi.fn().mockResolvedValue(),
        recognize: vi.fn().mockResolvedValue({ data: { text: 'Test text' } })
      })
    };
    // Mock window
    global.window = {
      ztools: undefined,
      document: {
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      },
      document: { createElement: vi.fn() }
    };
    global.document = global.window.document;
    delete global.navigator;
    global.navigator = {};
  });

  it('should use ztools.copyText when available', () => {
    global.window.ztools = { copyText: vi.fn().mockReturnValue(true) };
    const app = new OCRApp();
    app.resultText = { value: 'Test text' };

    const result = app.copyResult();

    expect(global.window.ztools.copyText).toHaveBeenCalledWith('Test text');
    expect(result).toBe(true);
  });

  it('should fall back to navigator.clipboard when ztools not available', async () => {
    global.navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
    const app = new OCRApp();
    app.resultText = { value: 'Test text' };

    app.copyResult();
    // navigator.clipboard is async, give it a tick
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith('Test text');
  });
});
