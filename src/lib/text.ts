import { getNormalizedBounds } from './geometry'
import type { Element, Point } from '../types'

export function findTextHit(elements: Element[], point: Point): Element | undefined {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (el.type !== 'text' || !el.text) continue
    const b = getNormalizedBounds(el)
    if (point.x >= b.x && point.x <= b.x + b.w && point.y >= b.y && point.y <= b.y + b.h) {
      return el
    }
  }
  return undefined
}

export function collectEmptyTextIds(elements: Element[]): string[] {
  return elements.filter((el) => el.type === 'text' && !el.text).map((el) => el.id)
}
