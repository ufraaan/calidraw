import { describe, it, expect } from 'vitest'
import { extractImageFiles, computePastePlacement, shiftElement } from './clipboard'
import type { Element } from '../types'

function file(name: string, type: string): File {
  return new File(['x'], name, { type })
}

describe('extractImageFiles', () => {
  it('reads clipboard items', () => {
    const f = file('a.png', 'image/png')
    const dt = { items: [{ type: 'image/png', getAsFile: () => f }] }
    expect(extractImageFiles(dt)).toEqual([f])
  })

  it('reads copied files (finder-style, no items)', () => {
    const f = file('b.png', 'image/png')
    expect(extractImageFiles({ files: [f] })).toEqual([f])
  })

  it('merges items and files without duplicates', () => {
    const shared = file('c.png', 'image/png')
    const other = file('d.png', 'image/png')
    const dt = {
      items: [{ type: 'image/png', getAsFile: () => shared }],
      files: [shared, other],
    }
    expect(extractImageFiles(dt)).toEqual([shared, other])
  })

  it('reads kind=file items with empty MIME (Finder / Safari screenshots)', () => {
    const f = file('shot.png', '')
    const dt = {
      items: [{ type: '', kind: 'file', getAsFile: () => f }],
    }
    expect(extractImageFiles(dt)).toEqual([f])
  })

  it('ignores non-images', () => {
    const dt = {
      items: [{ type: 'text/plain', getAsFile: () => null }],
      files: [file('e.pdf', 'application/pdf')],
    }
    expect(extractImageFiles(dt)).toEqual([])
  })

  it('tolerates null', () => {
    expect(extractImageFiles(null)).toEqual([])
    expect(extractImageFiles(undefined)).toEqual([])
  })
})

function rect(x: number, y: number, w = 100, h = 50): Element {
  return {
    id: 'orig',
    type: 'rectangle',
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: '#000',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    bowing: 1,
    opacity: 100,
  }
}

describe('computePastePlacement', () => {
  it('lands beside the original when there is no anchor', () => {
    const [p] = computePastePlacement([rect(0, 0)], null, 0)
    expect(p.x).toBe(24)
    expect(p.y).toBe(24)
    expect(p.id).not.toBe('orig')
  })

  it('centers the bbox on the anchor', () => {

    const [p] = computePastePlacement([rect(0, 0)], { x: 200, y: 200 }, 0)
    expect(p.x).toBe(150)
    expect(p.y).toBe(175)
  })

  it('cascades repeats', () => {
    const [p] = computePastePlacement([rect(0, 0)], { x: 200, y: 200 }, 16)
    expect(p.x).toBe(166)
    expect(p.y).toBe(191)
  })

  it('shifts path points with the element origin', () => {
    const moved = shiftElement(
      { ...rect(10, 20, 60, 60), type: 'line', points: [{ x: 10, y: 20 }, { x: 70, y: 80 }] },
      5,
      -3,
    )
    expect(moved.x).toBe(15)
    expect(moved.y).toBe(17)
    expect(moved.points).toEqual([{ x: 15, y: 17 }, { x: 75, y: 77 }])
  })

  it('keeps multi-paste layout and shifts points', () => {
    const line = {
      ...rect(0, 0, 60, 60),
      type: 'line' as const,
      points: [{ x: 0, y: 0 }, { x: 60, y: 60 }],
    }
    const [a, b] = computePastePlacement([rect(0, 0), line], null, 0)
    expect(b.x - a.x).toBe(0)
    expect(b.points).toEqual([{ x: 24, y: 24 }, { x: 84, y: 84 }])
  })
})
