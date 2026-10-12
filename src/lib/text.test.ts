import { describe, it, expect } from 'vitest'
import { findTextHit, collectEmptyTextIds } from './text'
import type { Element } from '../types'

function text(over: Partial<Element> = {}): Element {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'text',
    x: 10,
    y: 10,
    width: 100,
    height: 24,
    angle: 0,
    strokeColor: '#000',
    backgroundColor: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
    roughness: 0,
    bowing: 0,
    opacity: 100,
    text: 'hello',
    fontSize: 20,
    ...over,
  }
}

describe('findTextHit', () => {
  it('hits text containing the point', () => {
    const el = text()
    expect(findTextHit([el], { x: 50, y: 20 })?.id).toBe(el.id)
  })

  it('misses outside the bounds', () => {
    expect(findTextHit([text()], { x: 500, y: 500 })).toBeUndefined()
  })

  it('ignores empty placeholders', () => {
    expect(findTextHit([text({ text: '' })], { x: 50, y: 20 })).toBeUndefined()
  })

  it('ignores non-text elements', () => {
    const rect = text({ type: 'rectangle', text: undefined })
    expect(findTextHit([rect], { x: 50, y: 20 })).toBeUndefined()
  })

  it('prefers the topmost (last) element', () => {
    const bottom = text({ x: 0, y: 0, width: 200, height: 200 })
    const top = text({ x: 0, y: 0, width: 200, height: 200 })
    expect(findTextHit([bottom, top], { x: 50, y: 50 })?.id).toBe(top.id)
  })

  it('handles negative width/height', () => {
    const el = text({ x: 110, y: 34, width: -100, height: -24 })
    expect(findTextHit([el], { x: 50, y: 20 })?.id).toBe(el.id)
  })
})

describe('collectEmptyTextIds', () => {
  it('collects only empty text elements', () => {
    const empty1 = text({ text: '' })
    const empty2 = text({ text: undefined })
    const full = text()
    const rect = text({ type: 'rectangle', text: undefined })
    expect(collectEmptyTextIds([empty1, full, empty2, rect])).toEqual([empty1.id, empty2.id])
  })

  it('returns empty when nothing to collect', () => {
    expect(collectEmptyTextIds([text()])).toEqual([])
  })
})
