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

function getCommonBounds(elements: Element[]): Bounds | null {
  if (elements.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const el of elements) {
    const b = getElementBounds(el)
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }

  return { minX, minY, maxX, maxY }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function generateId(): string {
  return crypto.randomUUID()
}
