import { describe, expect, it, vi } from 'vitest';
import { createZtoolsThemeSync, resolveThemePrimaryColor } from '../plugin/src/theme.js';

function createDocument() {
  const rootClasses = new Set();
  const style = new Map();
  return {
    documentElement: {
      classList: {
        add: (name) => rootClasses.add(name),
        remove: (...names) => names.forEach((name) => rootClasses.delete(name)),
        contains: (name) => rootClasses.has(name),
      },
      style: {
        setProperty: (name, value) => style.set(name, value),
        removeProperty: (name) => style.delete(name),
      },
    },
    body: { classList: { add: () => {}, remove: () => {} } },
    rootClasses,
    style,
  };
}

describe('主色解析（与 ZTools 规则一致）', () => {
  it('命名主题按色阶取色，忽略残留的 customColor', () => {
    // 用户机器上的真实情况：primaryColor=blue + 旧的自定义色残留
    expect(resolveThemePrimaryColor({ primaryColor: 'blue', customColor: '#db2777' })).toBe('#0284c7');
    expect(resolveThemePrimaryColor({ primaryColor: 'purple', customColor: '#db2777' })).toBe('#7c3aed');
    expect(resolveThemePrimaryColor({ primaryColor: 'pink' })).toBe('#db2777');
  });

  it('只有 custom 主题才使用自定义色', () => {
    expect(resolveThemePrimaryColor({ primaryColor: 'custom', customColor: '#123456' })).toBe('#123456');
    expect(resolveThemePrimaryColor({ primaryColor: 'custom', customColor: 'bad' })).toBe('#059669');
  });

  it('未知主题回退到绿色', () => {
    expect(resolveThemePrimaryColor({})).toBe('#059669');
    expect(resolveThemePrimaryColor({ primaryColor: 'unknown' })).toBe('#059669');
  });
});

describe('ZTools theme sync', () => {
  it('按命名主题派生出完整的深色文字色阶', () => {
    const doc = createDocument();
    const listeners = [];
    const win = {
      ztools: {
        getThemeInfo: () => ({ isDark: true, primaryColor: 'blue', customColor: '#db2777' }),
        onThemeChange: (listener) => listeners.push(listener),
      },
    };

    const dispose = createZtoolsThemeSync({ win, doc });

    expect(doc.style.get('--primary-color')).toBe('#0284c7');
    expect(doc.style.get('--primary-hover')).toBe('#0274af');
    expect(doc.style.get('--primary-contrast')).toBe('#ffffff');
    expect(doc.rootClasses.has('dark')).toBe(false);

    listeners.forEach((listener) => listener({ primaryColor: 'purple' }));
    expect(doc.style.get('--primary-color')).toBe('#7c3aed');
    dispose();
    expect(doc.style.size).toBe(0);
  });

  it('优先采用宿主注入的 --plugin-primary-color', () => {
    const doc = createDocument();
    const win = {
      getComputedStyle: () => ({ getPropertyValue: () => '#ff8800' }),
      ztools: {
        getThemeInfo: () => ({ primaryColor: 'custom', customColor: '#123456' }),
        onThemeChange: () => {},
      },
    };

    createZtoolsThemeSync({ win, doc });

    expect(doc.style.get('--primary-color')).toBe('#ff8800');
    expect(doc.style.get('--primary-contrast')).toBe('#ffffff');
  });

  it('宿主注入非法值时回落到主题规则', () => {
    const doc = createDocument();
    const win = {
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
      ztools: {
        getThemeInfo: () => ({ primaryColor: 'green' }),
        onThemeChange: () => {},
      },
    };

    createZtoolsThemeSync({ win, doc });

    expect(doc.style.get('--primary-color')).toBe('#059669');
  });

  it('宿主没有主题 API 时不动样式', () => {
    const doc = createDocument();
    const dispose = createZtoolsThemeSync({ win: {}, doc });
    expect(doc.style.size).toBe(0);
    dispose();
  });
});
