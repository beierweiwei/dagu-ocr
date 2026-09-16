import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyImageDataUrl, dataUrlToBlob } from '../plugin/src/clipboard-image.js';

const DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dataUrlToBlob', () => {
  it('解析 MIME 类型与二进制内容', async () => {
    const blob = dataUrlToBlob(DATA_URL);

    expect(blob.type).toBe('image/png');
    expect(blob.size).toBe(68);
    expect(blob.size).toBe(Buffer.from(DATA_URL.split(',')[1], 'base64').length);
  });

  it('缺少 MIME 声明时按 PNG 处理', () => {
    expect(dataUrlToBlob('data:;base64,AAAA').type).toBe('image/png');
  });
});

describe('copyImageDataUrl', () => {
  it('优先调用宿主 copyImage', async () => {
    const win = { ztools: { copyImage: vi.fn().mockReturnValue(true) } };

    await expect(copyImageDataUrl(win, DATA_URL)).resolves.toBe(true);
    expect(win.ztools.copyImage).toHaveBeenCalledWith(DATA_URL);
  });

  it('宿主返回 false 时回退浏览器剪贴板', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const win = {
      ztools: { copyImage: vi.fn().mockReturnValue(false) },
      ClipboardItem: class { constructor(items) { this.items = items; } },
      navigator: { clipboard: { write } }
    };

    await expect(copyImageDataUrl(win, DATA_URL)).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0][0].items['image/png'].type).toBe('image/png');
  });

  it('utools.copyImage 同样被识别', async () => {
    const win = { utools: { copyImage: vi.fn().mockReturnValue(true) } };

    await expect(copyImageDataUrl(win, DATA_URL)).resolves.toBe(true);
    expect(win.utools.copyImage).toHaveBeenCalledWith(DATA_URL);
  });

  it('宿主抛错时回退浏览器剪贴板', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const win = {
      ztools: { copyImage: vi.fn(() => { throw new Error('宿主不支持图片复制'); }) },
      ClipboardItem: class { constructor(items) { this.items = items; } },
      navigator: { clipboard: { write } }
    };

    await expect(copyImageDataUrl(win, DATA_URL)).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('两种方式都不可用时返回 false', async () => {
    await expect(copyImageDataUrl({}, DATA_URL)).resolves.toBe(false);
    await expect(copyImageDataUrl(undefined, DATA_URL)).resolves.toBe(false);
    await expect(copyImageDataUrl({ navigator: { clipboard: { write: vi.fn() } } }, DATA_URL)).resolves.toBe(false);
  });
});
