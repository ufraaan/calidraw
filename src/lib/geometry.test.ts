import { describe, it, expect } from 'vitest'
import { getNormalizedBounds, getElementBounds, pointInBounds, getResizedElement } from './geometry'
import type { Element } from '../types'

function el(over: Partial<Element>): Element {
  return {
    id: 'x',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    strokeColor: '#000',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    bowing: 1,
    opacity: 100,
    ...over,
  }
}

describe('geometry bounds', () => {
  it('normalizes negative width/height', () => {
    const b = getNormalizedBounds(el({ x: 10, y: 10, width: -6, height: -4 }))
    expect(b).toEqual({ x: 4, y: 6, w: 6, h: 4 })
  })

  it('pointInBounds includes edges', () => {
    const b = getElementBounds(el({ x: 0, y: 0, width: 10, height: 10 }))
    expect(pointInBounds({ x: 0, y: 0 }, b)).toBe(true)
    expect(pointInBounds({ x: 10, y: 10 }, b)).toBe(true)
    expect(pointInBounds({ x: 11, y: 5 }, b)).toBe(false)
  })
})

describe('text resize scales the font', () => {
  const textEl = (over: Partial<Element> = {}): Element =>
    el({
      type: 'text',
      x: 10,
      y: 20,
      width: 100,
      height: 40,
      fontSize: 20,
      text: 'hi',
      ...over,
    })

  it('right-edge drag doubles width → doubles font, uniform box, left anchored', () => {
    const r = getResizedElement(textEl(), 'rm', { x: 210, y: 30 }, false)
    expect(r.fontSize).toBe(40)
    expect(r.x).toBe(10)
    expect(r.y).toBe(20)
    expect(r.width).toBe(200)
    expect(r.height).toBe(80)
  })

  it('left-edge drag shrinking anchors the right edge', () => {
    const r = getResizedElement(textEl(), 'lm', { x: 60, y: 30 }, false)
    // nw = 110 - 60 = 50 → scale 0.5 → font 10, box 50x20 at x 60
    expect(r.fontSize).toBe(10)
    expect(r.width).toBe(50)
    expect(r.height).toBe(20)
    expect(r.x).toBe(60)
    expect(r.y).toBe(20)
  })

  it('bottom-edge drag halves height → halves font, top anchored', () => {
    const r = getResizedElement(textEl(), 'bm', { x: 50, y: 40 }, false)
    expect(r.fontSize).toBe(10)
    expect(r.width).toBe(50)
    expect(r.height).toBe(20)
    expect(r.x).toBe(10)
    expect(r.y).toBe(20)
  })

  it('corner drag follows the dominant axis and anchors the opposite corner', () => {
    // tl dragged to (0, 0): sx = 1.1, sy = 1.5 → height wins → scale 1.5
    const r = getResizedElement(textEl(), 'tl', { x: 0, y: 0 }, false)
    expect(r.fontSize).toBe(30)
    expect(r.width).toBe(150)
    expect(r.height).toBe(60)
    expect(r.x).toBe(110 - 150)
    expect(r.y).toBe(60 - 60)
  })

  it('clamps the font to 6..400', () => {
    const huge = getResizedElement(textEl(), 'rm', { x: 10 + 100 * 100, y: 30 }, false)
    expect(huge.fontSize).toBe(400)
    const tiny = getResizedElement(textEl({ fontSize: 8 }), 'lm', { x: 109, y: 30 }, false)
    expect(tiny.fontSize).toBe(6)
  })

  it('non-text resize never touches fontSize', () => {
    const r = getResizedElement(el({ x: 0, y: 0, width: 100, height: 100 }), 'br', { x: 200, y: 200 }, false)
    expect(r.fontSize).toBeUndefined()
    expect(r.width).toBe(200)
    expect(r.height).toBe(200)
  })
})
