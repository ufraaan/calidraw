// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { onImageReady, seedImage, renderScene } from './renderer'
import type { Element } from '../types'

function imageEl(dataUrl: string): Element {
  return {
    id: 'img1',
    type: 'image',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    angle: 0,
    strokeColor: 'transparent',
    backgroundColor: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    roughness: 0,
    bowing: 0,
    opacity: 100,
    imageData: dataUrl,
  }
}

function fakeCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 300
  const calls: string[] = []
  const ctx = {
    canvas,
    drawImage: () => {
      calls.push('drawImage')
    },
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    setTransform: () => {},
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    translate: () => {},
    scale: () => {},
    beginPath: () => {},
    stroke: () => {},
    fill: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    setLineDash: () => {},
    fillText: () => {},
    measureText: () => ({ width: 10 }),
    __calls: calls,
  } as unknown as CanvasRenderingContext2D & { __calls: string[] }
  return ctx
}

describe('image ready redraw', () => {
  it('notifies listeners when a cached image finishes loading', async () => {

    let captured: { onload: (() => void) | null } | null = null
    const RealImage = globalThis.Image
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      complete = false
      _src = ''
      set src(v: string) {
        this._src = v
        captured = this as unknown as { onload: (() => void) | null }
      }
      get src() {
        return this._src
      }
    }
    // @ts-expect-error test double
    globalThis.Image = FakeImage
    try {
      const dataUrl = `data:image/png;base64,notify-${Date.now()}`
      const seen: string[] = []
      const unsub = onImageReady((key) => seen.push(key))
      try {
        const ctx = fakeCtx()
        renderScene(ctx, [imageEl(dataUrl)], new Set(), false, 1)
        expect(captured).toBeTruthy()

        expect((ctx as unknown as { __calls: string[] }).__calls).not.toContain('drawImage')

        captured!.onload?.()
        expect(seen).toEqual([dataUrl])
      } finally {
        unsub()
      }
    } finally {
      globalThis.Image = RealImage
    }
  })

  it('seeded (already-decoded) images draw on the first paint', () => {
    const dataUrl = `data:image/png;base64,seeded-${Date.now()}`
    const decoded = { complete: true } as unknown as HTMLImageElement
    seedImage(dataUrl, decoded)
    const ctx = fakeCtx()
    renderScene(ctx, [imageEl(dataUrl)], new Set(), false, 1)
    expect((ctx as unknown as { __calls: string[] }).__calls).toContain('drawImage')
  })

  it('unsubscribing stops notifications', () => {
    const seen: string[] = []
    const unsub = onImageReady((key) => seen.push(key))
    unsub()

    expect(seen).toEqual([])
    expect(typeof unsub).toBe('function')
    void vi.fn()
  })
})
