import { describe, expect, it } from 'vitest'
import {
  clampRectToBounds,
  handleAnchors,
  hitTestHandle,
  imageToViewport,
  moveSelection,
  nextToolbarPlacement,
  normalizeRect,
  resizeSelection,
  roundRect,
  selectionSizeLabel,
  viewportToImage,
  zoomAt
} from '../plugin/src/capture/geometry.js'
import {
  DEFAULT_TOOL_SETTINGS,
  loadToolSettings,
  saveToolSettings
} from '../plugin/src/capture/annotations.js'
import { displayPixelSize, pickSourceForDisplay } from '../plugin/src/capture/desktop-capture.js'

describe('选区几何', () => {
  it('归一化任意方向的拖拽', () => {
    expect(normalizeRect({ x: 120, y: 90 }, { x: 40, y: 30 })).toEqual({
      left: 40,
      top: 30,
      width: 80,
      height: 60
    })
  })

  it('按手柄调整大小时对边保持不动', () => {
    const rect = { left: 100, top: 100, width: 200, height: 120 }
    expect(resizeSelection(rect, 'se', { x: 340, y: 260 })).toEqual({
      left: 100,
      top: 100,
      width: 240,
      height: 160
    })
    expect(resizeSelection(rect, 'w', { x: 60, y: 0 })).toEqual({
      left: 60,
      top: 100,
      width: 240,
      height: 120
    })
  })

  it('调整大小时不会小于最小尺寸', () => {
    const rect = { left: 100, top: 100, width: 200, height: 120 }
    const resized = resizeSelection(rect, 'nw', { x: 500, y: 500 }, { minSize: 4 })
    expect(resized.width).toBeGreaterThanOrEqual(4)
    expect(resized.height).toBeGreaterThanOrEqual(4)
  })

  it('移动选区时限制在画面范围内', () => {
    const rect = { left: 100, top: 100, width: 200, height: 120 }
    const bounds = { width: 400, height: 300 }
    expect(moveSelection(rect, { x: -500, y: -500 }, bounds)).toMatchObject({ left: 0, top: 0 })
    expect(moveSelection(rect, { x: 500, y: 500 }, bounds)).toMatchObject({ left: 200, top: 180 })
    expect(clampRectToBounds({ ...rect, left: 999, top: 999 }, bounds)).toMatchObject({ left: 200, top: 180 })
  })

  it('命中手柄并给出方向', () => {
    const rect = { left: 100, top: 100, width: 200, height: 120 }
    const anchors = handleAnchors(rect)
    expect(hitTestHandle(rect, { x: anchors.se.x, y: anchors.se.y }, 8)).toBe('se')
    expect(hitTestHandle(rect, { x: anchors.n.x + 40, y: anchors.n.y }, 8)).toBe('')
  })

  it('尺寸标签使用像素单位', () => {
    expect(selectionSizeLabel({ left: 0, top: 0, width: 300.4, height: 251.2 })).toBe('300 × 251 px')
  })

  it('缩放锚点下的图像坐标保持不动', () => {
    const transform = { scale: 1, offsetX: 0, offsetY: 0 }
    const focus = { x: 400, y: 300 }
    const before = viewportToImage(focus, transform)
    const next = zoomAt(transform, 2, focus)
    const after = viewportToImage(focus, next)
    expect(next.scale).toBe(2)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
    expect(imageToViewport(before, next)).toMatchObject({ x: focus.x, y: focus.y })
  })

  it('取整后仍保持最小 1 像素的选区', () => {
    expect(roundRect({ left: 10.4, top: 10.6, width: 0.2, height: 0.2 })).toEqual({
      left: 10,
      top: 11,
      width: 1,
      height: 1
    })
  })

  it('工具条优先贴在选区下方，空间不足时改到上方', () => {
    const viewport = { width: 1280, height: 720 }
    const toolbar = { width: 520, height: 84 }
    expect(nextToolbarPlacement({
      selection: { left: 100, top: 100, width: 400, height: 200 },
      toolbar,
      viewport
    })).toMatchObject({ left: 100, top: 310, placement: 'below' })
    expect(nextToolbarPlacement({
      selection: { left: 100, top: 520, width: 400, height: 180 },
      toolbar,
      viewport
    })).toMatchObject({ placement: 'above' })
  })
})

describe('工具设置持久化', () => {
  function createStorage() {
    const store = new Map()
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, value)
    }
  }

  it('默认设置包含全部工具样式', () => {
    expect(DEFAULT_TOOL_SETTINGS.color).toBe('#ff4d4f')
    expect(DEFAULT_TOOL_SETTINGS.mosaicSize).toBeGreaterThan(1)
  })

  it('保存后可以读回', () => {
    const storage = createStorage()
    saveToolSettings({ ...DEFAULT_TOOL_SETTINGS, color: '#1890ff', lineWidth: 6 }, storage)
    expect(loadToolSettings(storage)).toMatchObject({ color: '#1890ff', lineWidth: 6 })
  })

  it('首次使用时迁移旧编辑器设置', () => {
    const storage = createStorage()
    storage.setItem('annotate_color', '#52c41a')
    storage.setItem('annotate_line_width', '5')
    storage.setItem('annotate_font_size', '36')
    expect(loadToolSettings(storage)).toMatchObject({
      color: '#52c41a',
      lineWidth: 5,
      fontSize: 36
    })
  })
})

describe('屏幕采集辅助', () => {
  it('按物理像素计算截图尺寸', () => {
    expect(displayPixelSize({ bounds: { width: 1920, height: 1080 }, scaleFactor: 1.25 })).toEqual({
      width: 2400,
      height: 1350
    })
  })

  it('优先匹配光标所在显示器', () => {
    const sources = [
      { id: 'screen:1:0', display_id: '2' },
      { id: 'screen:0:0', display_id: '1' }
    ]
    expect(pickSourceForDisplay(sources, { id: 1 })?.id).toBe('screen:0:0')
    expect(pickSourceForDisplay(sources, { id: 9 })?.id).toBe('screen:1:0')
    expect(pickSourceForDisplay([], { id: 1 })).toBeNull()
  })
})
