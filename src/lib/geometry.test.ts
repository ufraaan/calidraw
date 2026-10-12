import { describe, it, expect } from 'vitest'
import { getNormalizedBounds, getElementBounds, pointInBounds } from './geometry'
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
