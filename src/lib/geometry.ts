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

// ── Resize ─────────────────────────────────────────────────

export type ResizeHandle = 'tl' | 'tr' | 'bl' | 'br' | 'tm' | 'rm' | 'bm' | 'lm'

const HANDLE_NAMES: ResizeHandle[] = ['tl', 'tr', 'br', 'bl', 'tm', 'rm', 'bm', 'lm']

/** Normalised bounding box (x,y = top-left, w/h always positive). */
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

/** Returns the 8 resize-handle positions in canvas coords. */
export function getResizeHandles(element: Element): Point[] {
  const { x, y, w, h } = getNormalizedBounds(element)
  return [
    { x, y },                 // tl
    { x: x + w, y },          // tr
    { x: x + w, y: y + h },   // br
    { x, y: y + h },          // bl
    { x: x + w / 2, y },      // tm
    { x: x + w, y: y + h / 2 }, // rm
    { x: x + w / 2, y: y + h }, // bm
    { x, y: y + h / 2 },      // lm
  ]
}

/**
 * Hit-test the mouse against resize handles of an element.
 *
 * Corners are point-checked (must be near the exact corner).
 * Edges are line-checked — anywhere along the edge triggers resize,
 * making it much easier to grab.
 */
export function hitTestResizeHandle(
  point: Point,
  element: Element,
): ResizeHandle | null {
  const b = getNormalizedBounds(element)

  // For very small elements, fall back to the bounding box
  if (b.w < 8 || b.h < 8) {
    const handles = getResizeHandles(element)
    const threshold = 8
    for (let i = 0; i < handles.length; i++) {
      if (
        Math.abs(point.x - handles[i].x) <= threshold &&
        Math.abs(point.y - handles[i].y) <= threshold
      ) {
        return HANDLE_NAMES[i]
      }
    }
    return null
  }

  const threshold = 7

  // 1) Corners — point hit (takes priority)
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

  // 2) Edges — line hit (anywhere along the edge)
  const edgeThreshold = 8
  // Top edge
  if (
    Math.abs(point.y - b.y) <= edgeThreshold &&
    point.x >= b.x &&
    point.x <= b.x + b.w
  ) {
    return 'tm'
  }
  // Bottom edge
  if (
    Math.abs(point.y - (b.y + b.h)) <= edgeThreshold &&
    point.x >= b.x &&
    point.x <= b.x + b.w
  ) {
    return 'bm'
  }
  // Left edge
  if (
    Math.abs(point.x - b.x) <= edgeThreshold &&
    point.y >= b.y &&
    point.y <= b.y + b.h
  ) {
    return 'lm'
  }
  // Right edge
  if (
    Math.abs(point.x - (b.x + b.w)) <= edgeThreshold &&
    point.y >= b.y &&
    point.y <= b.y + b.h
  ) {
    return 'rm'
  }

  return null
}

/**
 * Compute the resized element given a handle and mouse position.
 * If `aspectLock` is true (Shift held) the original aspect ratio is preserved
 * for corner handles.
 */
export function getResizedElement(
  element: Element,
  handle: ResizeHandle,
  mouse: Point,
  aspectLock: boolean,
): Element {
  const b = getNormalizedBounds(element)
  let nx = b.x
  let ny = b.y
  let nw = b.w
  let nh = b.h

  // ── Apply raw mouse delta ──────────────────────────────────
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

  // Minimum size
  if (nw < 5) nw = 5
  if (nh < 5) nh = 5

  // ── Aspect-ratio lock (Shift) — corner handles only ────────
  if (aspectLock && (handle === 'tl' || handle === 'tr' || handle === 'bl' || handle === 'br')) {
    const ar = b.w / b.h

    // The anchor is the corner opposite the handle being dragged
    const anchorX = handle === 'br' || handle === 'tr' ? b.x : b.x + b.w
    const anchorY = handle === 'br' || handle === 'bl' ? b.y : b.y + b.h
    const dx = Math.abs(mouse.x - anchorX)
    const dy = Math.abs(mouse.y - anchorY)

    // Choose dominant axis (the one that moved more proportionally)
    if (dx / b.w >= dy / b.h) {
      nh = nw / ar
    } else {
      nw = nh * ar
    }

    // Reposition for corners that move their anchor
    if (handle === 'tl') {
      nx = b.x + b.w - nw
      ny = b.y + b.h - nh
    } else if (handle === 'tr') {
      ny = b.y + b.h - nh
    } else if (handle === 'bl') {
      nx = b.x + b.w - nw
    }
    // br: position unchanged (anchor is top-left)
  }

  return { ...element, x: nx, y: ny, width: nw, height: nh }
}
