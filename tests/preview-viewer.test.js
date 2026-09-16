import { describe, expect, it, vi } from 'vitest';
import {
  PREVIEW_MAX_SCALE,
  PREVIEW_MIN_SCALE,
  clampPreviewOffset,
  clampPreviewScale,
  createPreviewViewer,
  fittedPreviewSize,
  pannedPreviewView,
  previewTransform,
  scaleFromWheelDelta,
  scaledContentView,
  zoomedPreviewView
} from '../plugin/src/preview-viewer.js';

const VIEWPORT = { width: 400, height: 200 };
const NATURAL = { width: 800, height: 400 };
const CONTEXT = { viewport: VIEWPORT, naturalSize: NATURAL };

function fakeFrame({ width = 400, height = 200, left = 0, top = 0 } = {}) {
  const listeners = new Map();
  const frame = {
    clientWidth: width,
    clientHeight: height,
    classList: {
      values: new Set(),
      toggle(name, on) {
        if (on) this.values.add(name);
        else this.values.delete(name);
      },
      add(name) {
        this.values.add(name);
      },
      remove(name) {
        this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    addEventListener: vi.fn((type, handler) => listeners.set(type, handler)),
    removeEventListener: vi.fn((type) => listeners.delete(type)),
    getBoundingClientRect: () => ({ left, top, width, height }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    fire(type, event) {
      listeners.get(type)?.(event);
    }
  };
  return frame;
}

function fakeImage({ width = 0, height = 0, src = 'data:image/png;base64,AAAA' } = {}) {
  return { naturalWidth: width, naturalHeight: height, src, style: {} };
}

function wheelEvent({ clientX = 0, clientY = 0, deltaY = 0 } = {}) {
  return { clientX, clientY, deltaY, preventDefault: vi.fn() };
}

function pointerEvent({ type = 'pointerdown', clientX = 0, clientY = 0, button = 0, pointerId = 1 } = {}) {
  return { type, clientX, clientY, button, pointerId, preventDefault: vi.fn() };
}

describe('预览缩放纯函数', () => {
  it('缩放倍数夹在 1–8 之间', () => {
    expect(PREVIEW_MIN_SCALE).toBe(1);
    expect(PREVIEW_MAX_SCALE).toBe(8);
    expect(clampPreviewScale(0.2)).toBe(1);
    expect(clampPreviewScale(3.5)).toBe(3.5);
    expect(clampPreviewScale(99)).toBe(8);
    expect(clampPreviewScale(Number.NaN)).toBe(1);
  });

  it('按 contain 规则计算图片适配后的尺寸', () => {
    expect(fittedPreviewSize(VIEWPORT, NATURAL)).toEqual({ width: 400, height: 200 });
    expect(fittedPreviewSize({ width: 400, height: 800 }, NATURAL)).toEqual({ width: 400, height: 200 });
    expect(fittedPreviewSize(VIEWPORT, { width: 50, height: 50 })).toEqual({ width: 200, height: 200 });
    expect(fittedPreviewSize(VIEWPORT, null)).toEqual({ width: 0, height: 0 });
    expect(fittedPreviewSize(null, NATURAL)).toEqual({ width: 0, height: 0 });
  });

  it('平移量不允许拖出空白，内容小于预览框时始终居中', () => {
    expect(clampPreviewOffset({ x: 999, y: -999 }, { content: { width: 600, height: 400 }, viewport: VIEWPORT }))
      .toEqual({ x: 100, y: -100 });
    expect(clampPreviewOffset({ x: -999, y: 999 }, { content: { width: 600, height: 400 }, viewport: VIEWPORT }))
      .toEqual({ x: -100, y: 100 });
    expect(clampPreviewOffset({ x: 40, y: 40 }, { content: { width: 200, height: 100 }, viewport: VIEWPORT }))
      .toEqual({ x: 0, y: 0 });
  });

  it('滚轮向上放大、向下缩小', () => {
    expect(scaleFromWheelDelta(-120)).toBeGreaterThan(1);
    expect(scaleFromWheelDelta(120)).toBeLessThan(1);
    expect(scaleFromWheelDelta(0)).toBe(1);
  });

  it('内容尺寸等于适配尺寸乘以缩放倍数', () => {
    expect(scaledContentView({ scale: 2 }, CONTEXT)).toEqual({ width: 800, height: 400 });
    expect(scaledContentView({ scale: 99 }, CONTEXT)).toEqual({ width: 3200, height: 1600 });
  });

  it('以光标为锚点缩放时锚点下的内容保持不动', () => {
    const anchor = { x: 100, y: 50 };
    const zoomed = zoomedPreviewView({ scale: 1, x: 0, y: 0 }, { ...CONTEXT, anchor, factor: 2 });

    expect(zoomed.scale).toBe(2);
    expect(zoomed).toEqual({ scale: 2, x: -100, y: -50 });
  });

  it('缩放后平移量被内容边界夹住', () => {
    const zoomed = zoomedPreviewView(
      { scale: 2, x: 0, y: 0 },
      { ...CONTEXT, anchor: { x: 900, y: 900 }, factor: 4 }
    );

    expect(zoomed.scale).toBe(8);
    expect(zoomed).toEqual({ scale: 8, x: -1400, y: -700 });
  });

  it('达到最大倍数后不再改变视图', () => {
    const view = { scale: PREVIEW_MAX_SCALE, x: -10, y: -20 };

    expect(zoomedPreviewView(view, { ...CONTEXT, anchor: { x: 10, y: 10 }, factor: 2 })).toEqual(view);
  });

  it('拖动画布累加位移并夹在边界内', () => {
    expect(pannedPreviewView({ scale: 2, x: 0, y: 0 }, { x: 30, y: 20 }, CONTEXT)).toEqual({ scale: 2, x: 30, y: 20 });
    expect(pannedPreviewView({ scale: 2, x: 0, y: 0 }, { x: 9999, y: 9999 }, CONTEXT)).toEqual({ scale: 2, x: 200, y: 100 });
    expect(pannedPreviewView({ scale: 1, x: 0, y: 0 }, { x: 30, y: 20 }, CONTEXT)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('未缩放时不写 transform，缩放后输出平移与缩放', () => {
    expect(previewTransform({ scale: 1, x: 0, y: 0 })).toBe('');
    expect(previewTransform({ scale: 1, x: 10, y: 0 })).toBe('translate(10.00px, 0.00px) scale(1.0000)');
    expect(previewTransform({ scale: 2.5, x: -12, y: 4.5 })).toBe('translate(-12.00px, 4.50px) scale(2.5000)');
  });
});

describe('预览交互绑定', () => {
  it('没有预览框时返回空实现', () => {
    const viewer = createPreviewViewer({ frame: null });

    expect(viewer.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(() => viewer.setImage(null)).not.toThrow();
    expect(() => viewer.dispose()).not.toThrow();
  });

  it('滚轮以光标为锚点放大图片，并标记缩放状态', () => {
    const frame = fakeFrame();
    const image = fakeImage({ width: 800, height: 400 });
    const viewer = createPreviewViewer({ frame, win: null });
    viewer.setImage(image);

    const event = wheelEvent({ clientX: 300, clientY: 100, deltaY: -693 });
    frame.fire('wheel', event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(viewer.view.scale).toBeCloseTo(2.828, 3);
    expect(frame.classList.contains('is-zoomed')).toBe(true);
    expect(image.style.transform).toMatch(/^translate\(-?\d+\.\d\dpx, -?\d+\.\d\dpx\) scale\(2\.8\d\d\d\)$/);
  });

  it('缩小回原始倍数后清除缩放状态', () => {
    const frame = fakeFrame();
    const image = fakeImage({ width: 800, height: 400 });
    const viewer = createPreviewViewer({ frame, win: null });
    viewer.setImage(image);

    frame.fire('wheel', wheelEvent({ clientX: 300, clientY: 100, deltaY: -693 }));
    frame.fire('wheel', wheelEvent({ clientX: 300, clientY: 100, deltaY: 693 }));

    expect(viewer.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(frame.classList.contains('is-zoomed')).toBe(false);
    expect(previewTransform(viewer.view)).toBe('');
  });

  it('未缩放时按下不启动拖动', () => {
    const frame = fakeFrame();
    const viewer = createPreviewViewer({ frame, win: null });
    viewer.setImage(fakeImage({ width: 800, height: 400 }));

    const down = pointerEvent({ clientX: 10, clientY: 10 });
    frame.fire('pointerdown', down);
    frame.fire('pointermove', pointerEvent({ type: 'pointermove', clientX: 60, clientY: 40 }));

    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(frame.classList.contains('is-dragging')).toBe(false);
    expect(viewer.view).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it('放大后按住拖动平移，松开后结束拖动', () => {
    const frame = fakeFrame();
    const viewer = createPreviewViewer({ frame, win: null });
    viewer.setImage(fakeImage({ width: 800, height: 400 }));
    frame.fire('wheel', wheelEvent({ clientX: 200, clientY: 100, deltaY: -1386 }));

    const down = pointerEvent({ clientX: 100, clientY: 100 });
    frame.fire('pointerdown', down);
    expect(down.preventDefault).toHaveBeenCalled();
    expect(frame.classList.contains('is-dragging')).toBe(true);
    expect(frame.setPointerCapture).toHaveBeenCalledWith(1);

    frame.fire('pointermove', pointerEvent({ type: 'pointermove', clientX: 140, clientY: 130 }));
    expect(viewer.view.scale).toBeCloseTo(8, 2);
    expect(viewer.view.x).toBe(40);
    expect(viewer.view.y).toBe(30);

    frame.fire('pointerup', pointerEvent({ type: 'pointerup', clientX: 140, clientY: 130 }));
    expect(frame.classList.contains('is-dragging')).toBe(false);
    expect(frame.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('更换图片后重置缩放，重复设置同一张图片不重置', () => {
    const frame = fakeFrame();
    const viewer = createPreviewViewer({ frame, win: null });
    const first = fakeImage({ width: 800, height: 400 });
    viewer.setImage(first);
    frame.fire('wheel', wheelEvent({ clientX: 200, clientY: 100, deltaY: -693 }));
    expect(viewer.view.scale).toBeGreaterThan(1);

    viewer.setImage(first);
    expect(viewer.view.scale).toBeGreaterThan(1);

    viewer.setImage(fakeImage({ width: 800, height: 400, src: 'data:image/png;base64,BBBB' }));
    expect(viewer.view).toEqual({ scale: 1, x: 0, y: 0 });
    expect(frame.classList.contains('is-zoomed')).toBe(false);
  });

  it('dispose 解绑全部指针事件', () => {
    const frame = fakeFrame();
    const viewer = createPreviewViewer({ frame, win: null });
    viewer.setImage(fakeImage({ width: 800, height: 400 }));
    viewer.dispose();

    expect(frame.removeEventListener).toHaveBeenCalledTimes(6);
    expect(frame.classList.contains('is-zoomed')).toBe(false);
  });
});
