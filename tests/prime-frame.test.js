import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrimeKey, primeCaptureFrame, readPrimedFrame } from '../plugin/src/capture/prime-frame.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function fakeWin({ capture } = {}) {
  const store = new Map();
  const win = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    ztools: {
      desktopCaptureSources: capture || (async (options) => [{
        id: 'screen:0:0',
        display_id: 1,
        thumbnail: {
          getSize: () => ({ width: 100, height: 50 }),
          toDataURL: () => 'data:image/png;base64,FRAME'
        }
      }])
    },
    entries: () => [...store.entries()]
  };
  return win;
}

const DISPLAY = { id: 1, bounds: { x: 0, y: 0, width: 100, height: 50 }, scaleFactor: 1 };

describe('createPrimeKey', () => {
  it('每次生成不同的预抓帧键', () => {
    const first = createPrimeKey();
    const second = createPrimeKey();

    expect(first).toMatch(/^dagu-ocr-capture-\d+-[a-z0-9]+$/);
    expect(second).not.toBe(first);
  });
});

describe('primeCaptureFrame', () => {
  it('抓帧成功后写入预抓帧数据', async () => {
    const win = fakeWin();
    const key = createPrimeKey();

    const capture = await primeCaptureFrame({ win, display: DISPLAY, key, delayMs: 0 });

    expect(capture.dataUrl).toBe('data:image/png;base64,FRAME');
    expect(win.entries()).toHaveLength(1);
    expect(JSON.parse(win.localStorage.getItem(key))).toMatchObject({
      dataUrl: 'data:image/png;base64,FRAME',
      pixelSize: { width: 100, height: 50 }
    });
  });

  it('等待指定延时后才开始采集', async () => {
    vi.useFakeTimers();
    const win = fakeWin();
    const key = createPrimeKey();
    primeCaptureFrame({ win, display: DISPLAY, key, delayMs: 60 });

    await vi.advanceTimersByTimeAsync(59);
    expect(win.localStorage.getItem(key)).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(JSON.parse(win.localStorage.getItem(key)).dataUrl).toBe('data:image/png;base64,FRAME');
  });

  it('抓帧失败时写入失败标记，让覆盖层自行采集', async () => {
    const win = fakeWin({ capture: async () => { throw new Error('宿主不支持'); } });
    const key = createPrimeKey();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(primeCaptureFrame({ win, display: DISPLAY, key, delayMs: 0 })).resolves.toBeNull();

    expect(JSON.parse(win.localStorage.getItem(key))).toEqual({ failed: true });
    expect(warn).toHaveBeenCalled();
  });

  it('写入超限时通知覆盖层自行采集', async () => {
    const win = fakeWin();
    const key = createPrimeKey();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(win.localStorage, 'setItem').mockImplementation(() => { throw new Error('超出配额'); });
    win.localStorage.removeItem = vi.fn();

    await expect(primeCaptureFrame({ win, display: DISPLAY, key, delayMs: 0 }))
      .resolves.toMatchObject({ dataUrl: 'data:image/png;base64,FRAME' });
    expect(win.localStorage.removeItem).toHaveBeenCalledWith(key);
    expect(win.localStorage.getItem(key)).toBeNull();
  });

  it('没有 key 或没有存储时直接返回空', async () => {
    const win = fakeWin();

    await expect(primeCaptureFrame({ win, display: DISPLAY, key: '', delayMs: 0 })).resolves.toBeNull();
    await expect(primeCaptureFrame({ win: {}, display: DISPLAY, key: 'k', delayMs: 0 })).resolves.toBeNull();
  });
});

describe('readPrimedFrame', () => {
  it('读取成功后立即删除预抓帧', async () => {
    const win = fakeWin();
    const key = createPrimeKey();
    win.localStorage.setItem(key, JSON.stringify({ dataUrl: 'data:image/png;base64,FRAME', pixelSize: { width: 1, height: 1 } }));

    await expect(readPrimedFrame({ win, key })).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,FRAME' });
    expect(win.localStorage.getItem(key)).toBeNull();
  });

  it('主窗口标记失败时立即返回，不等待超时', async () => {
    const win = fakeWin();
    const key = createPrimeKey();
    win.localStorage.setItem(key, JSON.stringify({ failed: true }));
    const startedAt = Date.now();

    await expect(readPrimedFrame({ win, key, timeoutMs: 60000 })).resolves.toBeNull();

    expect(Date.now() - startedAt).toBeLessThan(200);
    expect(win.localStorage.getItem(key)).toBeNull();
  });

  it('等待超时后返回空', async () => {
    const win = fakeWin();

    await expect(readPrimedFrame({ win, key: createPrimeKey(), timeoutMs: 60, intervalMs: 10 })).resolves.toBeNull();
  });

  it('等到预抓帧出现后返回画面', async () => {
    const win = fakeWin();
    const key = createPrimeKey();
    const pending = readPrimedFrame({ win, key, timeoutMs: 500, intervalMs: 5 });

    setTimeout(() => {
      win.localStorage.setItem(key, JSON.stringify({ dataUrl: 'data:image/png;base64,LATE' }));
    }, 20);

    await expect(pending).resolves.toMatchObject({ dataUrl: 'data:image/png;base64,LATE' });
  });

  it('没有 key 或没有存储时返回空', async () => {
    const win = fakeWin();

    await expect(readPrimedFrame({ win, key: '' })).resolves.toBeNull();
    await expect(readPrimedFrame({ win: {}, key: 'k' })).resolves.toBeNull();
  });
});
