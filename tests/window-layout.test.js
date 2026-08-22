import { describe, expect, it, vi } from 'vitest';
import {
  createPluginWindowLayoutSync,
  measurePluginHeight
} from '../plugin/src/window-layout.js';

function createDocument(root, contentHeight = 620) {
  return {
    documentElement: { scrollHeight: contentHeight },
    body: { scrollHeight: contentHeight },
    querySelector: vi.fn().mockReturnValue(root)
  };
}

describe('ZTools plugin window layout', () => {
  it('uses the plugin root content height instead of the host viewport height', () => {
    const root = { scrollHeight: 650 };

    expect(measurePluginHeight({
      root,
      doc: createDocument(root),
      viewportHeight: 1104
    })).toBe(650);
  });

  it('forces a host resize after a rendered view update', () => {
    const root = { scrollHeight: 541 };
    const setExpendHeight = vi.fn();
    const win = {
      innerHeight: 541,
      ztools: { setExpendHeight },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const layout = createPluginWindowLayoutSync({
      win,
      doc: createDocument(root, 541),
      root
    });

    layout.sync();
    layout.sync();

    expect(setExpendHeight).toHaveBeenCalledTimes(2);
    expect(setExpendHeight).toHaveBeenLastCalledWith(541);
    layout.dispose();
  });

  it('does not resize the main plugin from a createBrowserWindow child', () => {
    const root = { scrollHeight: 541 };
    const setExpendHeight = vi.fn();
    const win = {
      innerHeight: 541,
      ztools: {
        getWindowType: vi.fn().mockReturnValue('browser'),
        setExpendHeight
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const layout = createPluginWindowLayoutSync({
      win,
      doc: createDocument(root, 541),
      root
    });

    layout.sync();

    expect(setExpendHeight).not.toHaveBeenCalled();
    layout.dispose();
  });
});
