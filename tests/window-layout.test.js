import { describe, expect, it, vi } from 'vitest';
import {
  createPluginWindowLayoutSync,
  UNIFIED_PLUGIN_HEIGHT
} from '../plugin/src/window-layout.js';

describe('ZTools 插件窗口统一高度', () => {
  it('所有主页面共用 4:3 的窗口高度', () => {
    expect(UNIFIED_PLUGIN_HEIGHT).toBe(600);
  });

  it('页面同步时请求统一高度', () => {
    const setExpendHeight = vi.fn();
    const layout = createPluginWindowLayoutSync({ win: { ztools: { setExpendHeight } } });

    layout.sync();

    expect(setExpendHeight).toHaveBeenCalledTimes(1);
    expect(setExpendHeight).toHaveBeenLastCalledWith(UNIFIED_PLUGIN_HEIGHT);
    layout.dispose();
  });

  it('同一帧内多次调度只请求一次', () => {
    const setExpendHeight = vi.fn();
    const callbacks = [];
    const win = {
      ztools: { setExpendHeight },
      requestAnimationFrame: (callback) => {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancelAnimationFrame: () => {}
    };
    const layout = createPluginWindowLayoutSync({ win });

    layout.schedule();
    layout.schedule();

    expect(callbacks).toHaveLength(1);
    callbacks[0]();
    expect(setExpendHeight).toHaveBeenCalledTimes(1);
    layout.dispose();
  });

  it('createBrowserWindow 子窗口不调整主窗口高度', () => {
    const setExpendHeight = vi.fn();
    const win = {
      ztools: {
        getWindowType: () => 'browser',
        setExpendHeight
      }
    };
    const layout = createPluginWindowLayoutSync({ win });

    layout.sync();

    expect(setExpendHeight).not.toHaveBeenCalled();
    layout.dispose();
  });

  it('没有宿主 API 时安静降级', () => {
    const layout = createPluginWindowLayoutSync({ win: {} });

    expect(() => {
      layout.schedule();
      layout.sync();
      layout.dispose();
    }).not.toThrow();
  });
});
