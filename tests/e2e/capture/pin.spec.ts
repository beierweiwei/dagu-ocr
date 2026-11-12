import { test, expect } from '@playwright/test'
import { TEST_IMAGE_1x1 } from '../../fixtures/test-data'

function stubPinZtools() {
  const calls: any[] = []
  ;(window as any).__ztoolsCalls = calls
  ;(window as any).ztools = {
    sendToParent: (channel: string, payload: any) => { calls.push({ channel, payload }) },
    getWindowType: () => 'browser',
    copyImage: (dataUrl: string) => {
      calls.push({ channel: 'copyImage', payload: { prefix: String(dataUrl).slice(0, 22) } })
      return true
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = 240
  canvas.height = 120
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#0ea5e9'
  context.fillRect(0, 0, 240, 120)
  localStorage.setItem('pin-test-key', canvas.toDataURL('image/png'))
}

test.describe('固定到屏幕的图片窗口', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(stubPinZtools)
  })

  test('加载固定图片并显示操作提示', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')

    const image = page.locator('#pin-image')
    await expect(image).toBeVisible()
    await expect.poll(async () => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(240)
    await expect(page.locator('#pin-hint')).toContainText('滚轮缩放')
  })

  test('滚轮缩放与拖动移动都会回传父窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.mouse.move(120, 60)
    await page.mouse.wheel(0, -120)
    await expect.poll(async () => page.evaluate(() => (window as any).__ztoolsCalls.length)).toBeGreaterThan(0)

    await page.mouse.move(60, 40)
    await page.mouse.down()
    await page.mouse.move(140, 100, { steps: 4 })
    await page.mouse.up()

    const events = await page.evaluate(() => (window as any).__ztoolsCalls.map((call: any) => call.payload.event))
    expect(events).toContain('pinZoom')
    expect(events).toContain('pinMove')

    const zoomCall = await page.evaluate(() => (window as any).__ztoolsCalls.find((call: any) => call.payload.event === 'pinZoom'))
    expect(zoomCall.payload).toMatchObject({ pinId: 'p1', source: 'pin' })
    expect(zoomCall.payload.factor).toBeGreaterThan(1)
  })

  test('双击与 Esc 关闭固定窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.mouse.dblclick(120, 60)
    await expect.poll(async () => (await page.evaluate(() => (window as any).__ztoolsCalls))
      .filter((call: any) => call.payload.event === 'pinClose').length).toBe(1)

    await page.keyboard.press('Escape')
    await expect.poll(async () => (await page.evaluate(() => (window as any).__ztoolsCalls))
      .filter((call: any) => call.payload.event === 'pinClose').length).toBe(2)
  })

  test('固定图片禁用浏览器原生拖拽，指针事件只用于移动窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    const result = await page.evaluate(() => {
      const image = document.getElementById('pin-image') as HTMLImageElement
      return new Promise((resolve) => {
        image.addEventListener('pointerdown', (event) => {
          resolve({ defaultPrevented: event.defaultPrevented, draggable: image.draggable })
        }, { once: true })
        image.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      })
    })

    expect(result).toEqual({ defaultPrevented: true, draggable: false })
  })

  test('父窗口创建固定图片后重新置顶，并按指针消息移动窗口', async ({ page }) => {
    const imageUrl = `data:image/png;base64,${TEST_IMAGE_1x1}`
    await page.addInitScript(() => {
      const calls: string[] = []
      ;(window as any).__pinWindowCalls = calls
      ;(window as any).__pinCreateOptions = null
      window.ztools = {
        createBrowserWindow: (_url: string, options: any) => {
          ;(window as any).__pinCreateOptions = options
          ;(window as any).__pinId = new URL(_url, window.location.href).searchParams.get('pinId')
          return {
            setAlwaysOnTop: (value: boolean) => { calls.push(`setAlwaysOnTop:${value}`) },
            setBounds: (bounds: any) => { calls.push(`setBounds:${bounds.x},${bounds.y}`) },
            moveTop: () => { calls.push('moveTop') },
            close: () => { calls.push('close') }
          }
        }
      }
    })
    await page.goto('/index.html')
    await page.waitForFunction(() => Boolean((window as any).app))

    await page.evaluate((value) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: {
        event: 'pinResult',
        imageUrl: value,
        bounds: { x: 100, y: 120, width: 240, height: 160 }
      }
    }, '*'), imageUrl)
    await expect.poll(() => page.evaluate(() => (window as any).__pinWindowCalls)).toContain('setAlwaysOnTop:true')

    await page.evaluate((pinId) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { source: 'pin', pinId, event: 'pinMove', x: 315, y: 272 }
    }, '*'), await page.evaluate(() => (window as any).__pinId))
    await expect.poll(() => page.evaluate(() => (window as any).__pinWindowCalls)).toContain('setBounds:315,272')

    expect(await page.evaluate(() => (window as any).__pinCreateOptions?.alwaysOnTop)).toBe(false)
  })

  test('右键固定图片显示复制、删除、编辑、OCR、翻译菜单', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()
    await expect(page.locator('#pin-menu')).toBeHidden()

    await page.locator('#pin-image').click({ button: 'right' })

    await expect(page.locator('#pin-menu')).toBeVisible()
    await expect(page.locator('#pin-menu button')).toHaveText(['复制', '删除', '编辑', 'OCR', '翻译'])
  })

  test('右键菜单复制当前固定图片且不关闭窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.locator('#pin-image').click({ button: 'right' })
    await page.locator('#pin-menu [data-action="copy"]').click()

    const copyCall = await page.evaluate(() => (window as any).__ztoolsCalls.find((call: any) => call.channel === 'copyImage'))
    expect(copyCall?.payload?.prefix).toContain('data:image/png;base64')
    await expect(page.locator('#pin-menu')).toBeHidden()
    expect(await page.evaluate(() => (window as any).__ztoolsCalls
      .filter((call: any) => call.payload?.event === 'pinClose').length)).toBe(0)
  })

  test('右键菜单删除固定图片', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    await page.locator('#pin-image').click({ button: 'right' })
    await page.locator('#pin-menu [data-action="delete"]').click()

    await expect.poll(() => page.evaluate(() => (window as any).__ztoolsCalls
      .some((call: any) => call.payload?.event === 'pinClose'))).toBe(true)
  })

  test('右键菜单编辑、OCR、翻译会把目标动作交回父窗口', async ({ page }) => {
    await page.goto('/pin.html?pinId=p1&pinKey=pin-test-key')
    await expect(page.locator('#pin-image')).toBeVisible()

    for (const action of ['edit', 'ocr', 'translate']) {
      await page.locator('#pin-image').click({ button: 'right', position: { x: 20, y: 20 } })
      await page.locator(`#pin-menu [data-action="${action}"]`).click()
    }

    const events = await page.evaluate(() => (window as any).__ztoolsCalls
      .map((call: any) => call.payload)
      .filter((payload: any) => payload?.event === 'pinAction'))
    expect(events.map((event: any) => event.action)).toEqual(['edit', 'ocr', 'translate'])
    expect(events.every((event: any) => event.pinId === 'p1')).toBe(true)
  })

  test('父窗口处理固定图片的编辑与识别翻译动作', async ({ page }) => {
    const imageUrl = `data:image/png;base64,${TEST_IMAGE_1x1}`
    await page.addInitScript(() => {
      const calls: string[] = []
      const urls: string[] = []
      ;(window as any).__pinActionCalls = calls
      ;(window as any).__pinActionUrls = urls
      ;(window as any).__pinIds = []
      window.ztools = {
        createBrowserWindow: (url: string) => {
          urls.push(url)
          const pinId = new URL(url, window.location.href).searchParams.get('pinId')
          if (pinId) (window as any).__pinIds.push(pinId)
          return {
            setAlwaysOnTop: () => {},
            setBounds: () => {},
            moveTop: () => {},
            close: () => { calls.push('close') }
          }
        }
      }
    })
    await page.goto('/index.html')
    await page.waitForFunction(() => Boolean((window as any).app))
    const sendPinResult = async (value: string) => {
      await page.evaluate((url) => window.postMessage({
        type: 'daguOcrEditorMessage',
        payload: { event: 'pinResult', imageUrl: url, bounds: { x: 10, y: 20, width: 100, height: 80 } }
      }, '*'), value)
      await page.waitForFunction(() => (window as any).__pinIds.length > 0)
      return page.evaluate(() => (window as any).__pinIds.pop())
    }
    const firstPinId = await sendPinResult(imageUrl)
    await page.evaluate(() => {
      (window as any).app.handleEditedImage = async (imageUrl: string, action: string) => {
        ;(window as any).__pinActionCalls.push(`handle:${action}:${imageUrl.slice(0, 22)}`)
      }
    })

    await page.evaluate((pinId) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { source: 'pin', pinId, event: 'pinAction', action: 'translate' }
    }, '*'), firstPinId)
    await expect.poll(() => page.evaluate(() => (window as any).__pinActionCalls)).toContain(`handle:translate:${imageUrl.slice(0, 22)}`)

    const secondPinId = await sendPinResult(imageUrl)
    await page.evaluate((pinId) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { source: 'pin', pinId, event: 'pinAction', action: 'edit' }
    }, '*'), secondPinId)
    await expect.poll(() => page.evaluate(() => (window as any).__pinActionUrls.some((url: string) => url.includes('mode=image')))).toBe(true)
    await expect.poll(() => page.evaluate(() => (window as any).__pinActionCalls.filter((item: string) => item === 'close').length)).toBeGreaterThanOrEqual(2)
  })

  test('固定图片 OCR 处理完成前保留子窗口，避免插件进程被回收', async ({ page }) => {
    const imageUrl = `data:image/png;base64,${TEST_IMAGE_1x1}`
    await page.addInitScript(() => {
      const calls: string[] = []
      ;(window as any).__pinLifecycleCalls = calls
      ;(window as any).__pinLifecyclePinId = ''
      ;(window as any).__resolvePinProvider = null
      localStorage.setItem('dagu-ocr.preferences', JSON.stringify({
        ocrProviderId: 'ztools:mock-ocr',
        translationProviderId: 'ztools:mock-translation',
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        syncSecrets: false
      }))
      window.ztools = {
        showMainWindow: async () => { calls.push('showMainWindow') },
        providers: {
          getProviders: async (type: string) => [{ id: `mock-${type}`, label: `测试 ${type}` }],
          invokeProvider: async (type: string) => new Promise((resolve) => {
            calls.push(`provider:${type}`)
            ;(window as any).__resolvePinProvider = (value: string) => resolve(value)
          })
        },
        createBrowserWindow: (url: string) => {
          ;(window as any).__pinLifecyclePinId = new URL(url, window.location.href).searchParams.get('pinId') || ''
          return {
            setAlwaysOnTop: () => {},
            setBounds: () => {},
            moveTop: () => {},
            close: () => { calls.push('closePin') }
          }
        }
      }
    })
    await page.goto('/index.html')
    await page.waitForFunction(() => Boolean((window as any).app))
    await page.evaluate((url) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { event: 'pinResult', imageUrl: url, bounds: { x: 10, y: 20, width: 100, height: 80 } }
    }, '*'), imageUrl)
    await page.waitForFunction(() => Boolean((window as any).app))
    await page.waitForFunction(() => Boolean((window as any).__pinLifecyclePinId))
    const pinId = await page.evaluate(() => (window as any).__pinLifecyclePinId)

    await page.evaluate((id) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { source: 'pin', pinId: id, event: 'pinAction', action: 'ocr' }
    }, '*'), pinId)

    await expect.poll(() => page.evaluate(() => (window as any).__pinLifecycleCalls)).toEqual(['showMainWindow', 'provider:ocr'])
    await page.waitForTimeout(150)
    expect(await page.evaluate(() => (window as any).__pinLifecycleCalls.includes('closePin'))).toBe(false)

    await page.evaluate(() => (window as any).__resolvePinProvider('Mock OCR Result'))
    await expect.poll(() => page.evaluate(() => (window as any).__pinLifecycleCalls)).toEqual(['showMainWindow', 'provider:ocr', 'closePin'])
    await expect(page.locator('#resultText')).toHaveValue('Mock OCR Result')
  })

  test('存在固定图片时不退出插件主视图，删除最后一张后再退出', async ({ page }) => {
    const imageUrl = `data:image/png;base64,${TEST_IMAGE_1x1}`
    await page.addInitScript(() => {
      const calls: string[] = []
      ;(window as any).__pinPluginLifecycleCalls = calls
      ;(window as any).__pinPluginPinId = ''
      window.ztools = {
        outPlugin: async () => { calls.push('outPlugin') },
        createBrowserWindow: (url: string) => {
          ;(window as any).__pinPluginPinId = new URL(url, window.location.href).searchParams.get('pinId') || ''
          return {
            setAlwaysOnTop: () => {},
            setBounds: () => {},
            moveTop: () => {},
            close: () => { calls.push('closePin') }
          }
        }
      }
    })
    await page.goto('/index.html')
    await page.waitForFunction(() => Boolean((window as any).app))
    await page.evaluate((url) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { event: 'pinResult', imageUrl: url, bounds: { x: 10, y: 20, width: 100, height: 80 } }
    }, '*'), imageUrl)
    await page.waitForFunction(() => Boolean((window as any).__pinPluginPinId))
    const pinId = await page.evaluate(() => (window as any).__pinPluginPinId)

    await page.evaluate(() => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { event: 'closed' }
    }, '*'))
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => (window as any).__pinPluginLifecycleCalls)).toEqual([])

    await page.evaluate((id) => window.postMessage({
      type: 'daguOcrEditorMessage',
      payload: { source: 'pin', pinId: id, event: 'pinClose' }
    }, '*'), pinId)
    await expect.poll(() => page.evaluate(() => (window as any).__pinPluginLifecycleCalls)).toEqual(['closePin', 'outPlugin'])
  })
})
