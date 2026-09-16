import { describe, expect, it } from 'vitest'
import { pngSizeFromDataUrl } from '../plugin/src/image-size.js'

function pngDataUrl(width, height) {
  const bytes = new Uint8Array(24)
  const view = new DataView(bytes.buffer)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
  bytes.set([0, 0, 0, 13], 8)
  bytes.set([73, 72, 68, 82], 12)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

describe('pngSizeFromDataUrl', () => {
  it('reads PNG dimensions without decoding the image', () => {
    expect(pngSizeFromDataUrl(pngDataUrl(2400, 400))).toEqual({ width: 2400, height: 400 })
  })

  it('returns null for non-PNG or malformed images', () => {
    expect(pngSizeFromDataUrl('data:image/jpeg;base64,AAAA')).toBeNull()
    expect(pngSizeFromDataUrl('data:image/png;base64,AAAA')).toBeNull()
  })
})
