import { describe, expect, it, vi } from 'vitest';
import { OCRApp } from '../plugin/src/ocr.js';

describe('Screenshot routing', () => {
  it('passes the capture callback to the ZTools screenshot API', () => {
    const capture = vi.fn((callback) => callback('data:image/png;base64,screenshot'));
    const app = new OCRApp({ win: { ztools: { screenCapture: capture } } });
    const callback = vi.fn();

    app.captureScreen(callback);

    expect(capture).toHaveBeenCalledWith(callback);
    expect(callback).toHaveBeenCalledWith('data:image/png;base64,screenshot');
  });

  it('reports unsupported capture environments instead of throwing', () => {
    const app = new OCRApp({ win: {} });

    app.captureScreen(vi.fn());

    expect(app.state.status).toBe('当前环境不支持截图功能');
  });
});
