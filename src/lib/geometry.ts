import type { Element, Point, Bounds } from '../types'

export function getElementBounds(element: Element): Bounds {
  const { x, y, width, height } = element
  return {
    minX: Math.min(x, x + width),
    minY: Math.min(y, y + height),
    maxX: Math.max(x, x + width),
    maxY: Math.max(y, y + height),
  }
}

export function pointInBounds(point: Point, bounds: Bounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  )
}

export function hitTest(point: Point, element: Element): boolean {
  const bounds = getElementBounds(element)
  return pointInBounds(point, bounds)
}

export function generateId(): string {
  return crypto.randomUUID()
}
