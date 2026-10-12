import { describe, it, expect } from 'vitest'
import { sceneToJSON, sceneFromJSON } from './renderer'
import type { Element } from '../types'

const base: Element = {
  id: 'a',
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
}

describe('scene json round-trip', () => {
  it('serializes and parses back', () => {
    const els = sceneFromJSON(sceneToJSON([base]))
    expect(els).toEqual([base])
  })

  it('rejects garbage', () => {
    expect(sceneFromJSON('nope')).toBeNull()
    expect(sceneFromJSON('{"nope":true}')).toBeNull()
  })
})
