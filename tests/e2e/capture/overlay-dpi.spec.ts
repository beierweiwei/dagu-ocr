import { test, expect } from '@playwright/test'
import { CaptureOverlayPage, installZtoolsStub } from '../../pages/CaptureOverlayPage'

// 复现真实客户端高分屏环境（temp 诊断转储 2026-10-29）：
// 显示器 1440×900 DIP @ scaleFactor 1.5，覆盖层先在工作区 1440×852 下完成初始化，
// 父窗口收到 ready 后 setBounds 恢复 1440×900，覆盖层 resize 重新适配；
// 冻结帧为预抓帧路径传入的物理分辨率图像（高分屏 2160×1350）。
const DISPLAY = { width: 1440, height: 900 }
const WORKAREA = { width: 1440, height: 852 }
// 高分屏冻帧：物理分辨率 2160×1350（1440×900 @ 1.5）
const PHYSICAL_FRAME = { width: 2160, height: 1350 }
const DRAG = { from: { x: 300, y: 200 }, to: { x: 1200, y: 800 } }
const BLOCK = 90

// 冻结帧内容：90px 分块纯色网格，保证导出像素可逐点比对。
function buildFrameScript(key: string, frameSize: { width: number; height: number }) {
  return `(() => {
    const canvas = document.createElement('canvas')
    canvas.width = ${frameSize.width}
    canvas.height = ${frameSize.height}
    const ctx = canvas.getContext('2d')
    for (let by = 0; by < canvas.height / ${BLOCK}; by++) {
      for (let bx = 0; bx < canvas.width / ${BLOCK}; bx++) {
        ctx.fillStyle = 'rgb(' + ((bx * 67 + 13) % 256) + ',' + ((by * 83 + 29) % 256) + ',' + ((bx * 29 + by * 47 + 5) % 256) + ')'
        ctx.fillRect(bx * ${BLOCK}, by * ${BLOCK}, ${BLOCK}, ${BLOCK})
      }
    }
    const dataUrl = canvas.toDataURL('image/png')
    localStorage.setItem(${JSON.stringify(key)}, JSON.stringify({
      dataUrl,
      pixelSize: { width: ${frameSize.width}, height: ${frameSize.height} },
      captureMs: 42
    }))
  })()`
}

// 导出当前选区，逐点比对导出像素与源图对应位置像素；返回错位点列表。
async function compareExportWithSource(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const rect = window.__captureOverlay.state.selection
    const stage = window.__captureOverlay.stage
    const out = new Image()
    await new Promise((resolve, reject) => {
      out.onload = resolve
      out.onerror = () => reject(new Error('导出图解码失败'))
      out.src = stage.exportDataUrl(rect)
    })
    const outCanvas = document.createElement('canvas')
    outCanvas.width = out.naturalWidth
    outCanvas.height = out.naturalHeight
    const outCtx = outCanvas.getContext('2d')
    outCtx.drawImage(out, 0, 0)
    const src = stage.imageElement
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = src.naturalWidth
    srcCanvas.height = src.naturalHeight
    const srcCtx = srcCanvas.getContext('2d')
    srcCtx.drawImage(src, 0, 0)
    const samples = [[0, 0], [5, 5], [674, 449], [1344, 894], [1339, 449], [674, 894], [45, 135]]
    const mismatched = samples
      .filter(([dx, dy]) => dx < rect.width && dy < rect.height)
      .filter(([dx, dy]) => {
        const got = outCtx.getImageData(dx, dy, 1, 1).data
        const want = srcCtx.getImageData(rect.left + dx, rect.top + dy, 1, 1).data
        return got[0] !== want[0] || got[1] !== want[1] || got[2] !== want[2]
      })
    return {
      size: { width: out.naturalWidth, height: out.naturalHeight },
      mismatched,
      devicePixelRatio: window.devicePixelRatio
    }
  })
}

test.describe('高DPI截图错位', () => {
  // zoom = 整屏 fit 缩放 = 窗口DIP / 帧物理像素。
  // 高分屏 dpr 1.5 → zoom 2/3（症状场景）；普通屏 dpr 1 → zoom 1（历史正常对照）。
  const scenarios = [
    { name: '高分屏 dpr=1.5', dpr: 1.5, frame: PHYSICAL_FRAME },
    { name: '普通屏 dpr=1', dpr: 1, frame: { width: DISPLAY.width, height: DISPLAY.height } }
  ]

  for (const { name, dpr, frame } of scenarios) {
    const zoom = Math.min(DISPLAY.width / frame.width, DISPLAY.height / frame.height)

    test.describe(name, () => {
      test.use({ viewport: WORKAREA, deviceScaleFactor: dpr })

      test('选区导出内容与所选屏幕位置一致', async ({ page }) => {
        await page.addInitScript(installZtoolsStub())
        const overlay = new CaptureOverlayPage(page)
        const primeKey = `dagu-ocr-capture-dpi-${String(dpr).replace('.', '-')}`

        await page.goto('/index.html')
        await page.evaluate(buildFrameScript(primeKey, frame))

        await page.setViewportSize(WORKAREA)
        await overlay.goto({
          displayWidth: DISPLAY.width,
          displayHeight: DISPLAY.height,
          scaleFactor: dpr,
          primeKey
        })

        // 真实客户端时序：初始化时窗口仍被压在工作区尺寸
        expect(await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio })))
          .toEqual({ w: WORKAREA.width, h: WORKAREA.height, dpr })

        // 父窗口收到 ready 后 setBounds 恢复整屏，覆盖层 resize 重新适配
        await page.setViewportSize(DISPLAY)
        await page.waitForFunction((target) => Math.abs(window.__captureOverlay.stage.zoomScale() - target) < 1e-9, zoom)
        expect(await page.evaluate(() => window.__captureOverlay.stage.zoomScale())).toBeCloseTo(zoom, 9)

        // 拖拽选区：CSS 矩形除以 zoom 得图像空间选区
        await overlay.drag(DRAG.from, DRAG.to)
        const expectedRect = {
          left: Math.round(DRAG.from.x / zoom),
          top: Math.round(DRAG.from.y / zoom),
          width: Math.round((DRAG.to.x - DRAG.from.x) / zoom),
          height: Math.round((DRAG.to.y - DRAG.from.y) / zoom)
        }
        expect(await overlay.state()).toMatchObject({ selection: expectedRect })

        // 选区视觉层应与拖拽位置重合（屏幕上的错位）
        await expect(overlay.mask).toHaveAttribute('style', new RegExp(`left: ${DRAG.from.x}px`))
        await expect(overlay.mask).toHaveAttribute('style', new RegExp(`top: ${DRAG.from.y}px`))
        await expect(overlay.mask).toHaveAttribute('style', /width: 900px/)
        await expect(overlay.mask).toHaveAttribute('style', /height: 600px/)

        // 导出内容应与所选区域逐点一致（导出内容的错位）
        const result = await compareExportWithSource(page)
        expect(result.devicePixelRatio).toBe(dpr)
        expect(result.size).toEqual({ width: expectedRect.width, height: expectedRect.height })
        expect(result.mismatched).toEqual([])
      })
    })
  }
})
