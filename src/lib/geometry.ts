import type { Element, Point, Bounds } from '../types'
import { canvasStore } from '../stores/canvas-store'

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

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const dot = apx * abx + apy * aby
  const len2 = abx * abx + aby * aby
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, dot / len2))
  const cx = ax + t * abx
  const cy = ay + t * aby
  const dx = px - cx
  const dy = py - cy
  return Math.sqrt(dx * dx + dy * dy)
}

export function hitTest(point: Point, element: Element): boolean {

  if (element.points && element.points.length >= 2) {
    const zoom = canvasStore?.state?.zoom ?? 1
    const threshold = 12 / Math.max(1, zoom)
    const bounds = getElementBounds(element)
    if (
      point.x < bounds.minX - threshold ||
      point.x > bounds.maxX + threshold ||
      point.y < bounds.minY - threshold ||
      point.y > bounds.maxY + threshold
    ) {
      return false
    }
    for (let i = 1; i < element.points.length; i++) {
      const a = element.points[i - 1]
      const b = element.points[i]
      if (distToSegment(point.x, point.y, a.x, a.y, b.x, b.y) < threshold) return true
    }
    return false
  }

  const bounds = getElementBounds(element)
  return pointInBounds(point, bounds)
}

export function getRotationHandlePosition(element: Element): Point {
  const b = getNormalizedBounds(element)
  return { x: b.x + b.w / 2, y: b.y - 28 }
}

export function hitTestRotationHandle(point: Point, element: Element): boolean {
  const handle = getRotationHandlePosition(element)
  const threshold = 14
  return Math.abs(point.x - handle.x) <= threshold && Math.abs(point.y - handle.y) <= threshold
}

export function getRotationAngle(element: Element, mouse: Point): number {
  const b = getNormalizedBounds(element)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return Math.atan2(mouse.y - cy, mouse.x - cx)
}

export function generateId(): string {
  return crypto.randomUUID()
}

export type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'rm' | 'bm' | 'lm' | 'start' | 'end'

const HANDLE_NAMES: ResizeHandle[] = ['tl', 'tr', 'br', 'bl', 'tm', 'rm', 'bm', 'lm']

export function getNormalizedBounds(element: Element): {
  x: number
  y: number
  w: number
  h: number
} {
  const { x, y, width, height } = element
  return {
    x: width >= 0 ? x : x + width,
    y: height >= 0 ? y : y + height,
    w: Math.abs(width),
    h: Math.abs(height),
  }
}

export function getResizeHandles(element: Element): Point[] {

  if (element.type === 'arrow') {
    return [
      { x: element.x, y: element.y },
      { x: element.x + element.width, y: element.y + element.height },
    ]
  }
  const { x, y, w, h } = getNormalizedBounds(element)
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ]
}

export function hitTestResizeHandle(
  point: Point,
  element: Element,
): ResizeHandle | null {
  const threshold = 7

  if (element.type === 'arrow') {
    const start = { x: element.x, y: element.y }
    const end = { x: element.x + element.width, y: element.y + element.height }

    if (
      Math.abs(point.x - start.x) <= threshold &&
      Math.abs(point.y - start.y) <= threshold
    ) {
      return 'start'
    }
    if (
      Math.abs(point.x - end.x) <= threshold &&
      Math.abs(point.y - end.y) <= threshold
    ) {
      return 'end'
    }
    return null
  }

  const b = getNormalizedBounds(element)

  if (b.w < 8 || b.h < 8) {
    const handles = getResizeHandles(element)
    const thresh = 8
    for (let i = 0; i < handles.length; i++) {
      if (
        Math.abs(point.x - handles[i].x) <= thresh &&
        Math.abs(point.y - handles[i].y) <= thresh
      ) {
        return HANDLE_NAMES[i]
      }
    }
    return null
  }

  const corners: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'tl', x: b.x, y: b.y },
    { handle: 'tr', x: b.x + b.w, y: b.y },
    { handle: 'br', x: b.x + b.w, y: b.y + b.h },
    { handle: 'bl', x: b.x, y: b.y + b.h },
  ]
  for (const c of corners) {
    if (
      Math.abs(point.x - c.x) <= threshold &&
      Math.abs(point.y - c.y) <= threshold
    ) {
      return c.handle
    }
  }

  const edgeThreshold = 8

  if (
    Math.abs(point.y - b.y) <= edgeThreshold &&
    point.x >= b.x &&
    point.x <= b.x + b.w
  ) {
    return 'tm'
  }

  if (
    Math.abs(point.y - (b.y + b.h)) <= edgeThreshold &&
    point.x >= b.x &&
    point.x <= b.x + b.w
  ) {
    return 'bm'
  }

  if (
    Math.abs(point.x - b.x) <= edgeThreshold &&
    point.y >= b.y &&
    point.y <= b.y + b.h
  ) {
    return 'lm'
  }

  if (
    Math.abs(point.x - (b.x + b.w)) <= edgeThreshold &&
    point.y >= b.y &&
    point.y <= b.y + b.h
  ) {
    return 'rm'
  }

  return null
}

export function getResizedElement(
  element: Element,
  handle: ResizeHandle,
  mouse: Point,
  aspectLock: boolean,
): Element {

  if (element.type === 'arrow') {
    if (handle === 'start') {

      const endX = element.x + element.width
      const endY = element.y + element.height
      const nx = mouse.x
      const ny = mouse.y
      return { ...element, x: nx, y: ny, width: endX - nx, height: endY - ny }
    }
    if (handle === 'end') {

      const nx = element.x
      const ny = element.y
      return { ...element, x: nx, y: ny, width: mouse.x - nx, height: mouse.y - ny }
    }
  }

  const b = getNormalizedBounds(element)
  let nx = b.x
  let ny = b.y
  let nw = b.w
  let nh = b.h

  switch (handle) {
    case 'br':
      nw = mouse.x - b.x
      nh = mouse.y - b.y
      break
    case 'bl':
      nx = mouse.x
      nw = b.x + b.w - mouse.x
      nh = mouse.y - b.y
      break
    case 'tr':
      ny = mouse.y
      nw = mouse.x - b.x
      nh = b.y + b.h - mouse.y
      break
    case 'tl':
      nx = mouse.x
      ny = mouse.y
      nw = b.x + b.w - mouse.x
      nh = b.y + b.h - mouse.y
      break
    case 'tm':
      ny = mouse.y
      nh = b.y + b.h - mouse.y
      break
    case 'bm':
      nh = mouse.y - b.y
      break
    case 'lm':
      nx = mouse.x
      nw = b.x + b.w - mouse.x
      break
    case 'rm':
      nw = mouse.x - b.x
      break
  }

  if (nw < 5) nw = 5
  if (nh < 5) nh = 5

  if (aspectLock && (handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br')) {
    const ar = b.w / b.h

    const anchorX = handle === 'br' || handle === 'tr' ? b.x : b.x + b.w
    const anchorY = handle === 'br' || handle === 'bl' ? b.y : b.y + b.h
    const dx = Math.abs(mouse.x - anchorX)
    const dy = Math.abs(mouse.y - anchorY)

    if (dx / b.w >= dy / b.h) {
      nh = nw / ar
    } else {
      nw = nh * ar
    }

    if (handle === 'tl') {
      nx = b.x + b.w - nw
      ny = b.y + b.h - nh
    } else if (handle === 'tr') {
      ny = b.y + b.h - nh
    } else if (handle === 'bl') {
      nx = b.x + b.w - nw
    }

  }

  if (element.points) {
    const ob = getNormalizedBounds(element)
    const sx = ob.w > 0 ? nw / ob.w : 1
    const sy = ob.h > 0 ? nh / ob.h : 1
    const newPoints = element.points.map((p) => ({
      x: nx + (p.x - ob.x) * sx,
      y: ny + (p.y - ob.y) * sy,
    }))
    return { ...element, x: nx, y: ny, width: nw, height: nh, points: newPoints }
  }

  // Text resizes by scaling the font — the renderer draws glyphs at
  // fontSize and ignores the box, so a box-only resize would look like
  // nothing happened. Scale uniformly, anchored at the edge/corner
  // opposite the dragged handle, so the box keeps hugging the content.
  if (element.type === 'text') {
    const oldFont = element.fontSize ?? 20
    let scale: number
    if (handle === 'lm' || handle === 'rm') {
      scale = b.w > 0 ? nw / b.w : 1
    } else if (handle === 'tm' || handle === 'bm') {
      scale = b.h > 0 ? nh / b.h : 1
    } else {
      // Corners: follow whichever axis moved more, relative to its size.
      const sx = b.w > 0 ? nw / b.w : 1
      const sy = b.h > 0 ? nh / b.h : 1
      scale = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy
    }
    if (!Number.isFinite(scale) || scale <= 0) scale = 1
    const newFont = Math.min(400, Math.max(6, Math.round(oldFont * scale)))
    const applied = newFont / oldFont
    const uw = Math.max(5, b.w * applied)
    const uh = Math.max(5, b.h * applied)
    // Anchor the edge/corner opposite the dragged handle.
    const ax = handle === 'tl' || handle === 'bl' || handle === 'lm' ? b.x + b.w - uw : b.x
    const ay = handle === 'tl' || handle === 'tr' || handle === 'tm' ? b.y + b.h - uh : b.y
    return { ...element, x: ax, y: ay, width: uw, height: uh, fontSize: newFont }
  }

  return { ...element, x: nx, y: ny, width: nw, height: nh }
}
