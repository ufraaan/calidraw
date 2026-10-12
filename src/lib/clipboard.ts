import { generateId, getNormalizedBounds } from './geometry'
import { isImageFile } from './image'
import type { Element, Point } from '../types'

export interface TransferLike {
  items?: ArrayLike<{
    type: string
    kind?: string
    getAsFile?: () => File | null
  }> | null
  files?: ArrayLike<File> | null
  getData?: (format: string) => string
}

export function extractImageFiles(dt: TransferLike | null | undefined): File[] {
  if (!dt) return []
  const out: File[] = []
  const seen = new Set<File>()
  const push = (f: File | null | undefined) => {
    if (isImageFile(f) && !seen.has(f)) {
      seen.add(f)
      out.push(f)
    }
  }
  try {
    if (dt.items) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i]
        if (!item || typeof item.getAsFile !== 'function') continue
        const imageType = item.type.startsWith('image/')
        const asFile = item.kind === 'file' || imageType || !item.type
        if (asFile) push(item.getAsFile())
      }
    }
  } catch {

  }
  try {
    if (dt.files) {
      for (let i = 0; i < dt.files.length; i++) {
        push(dt.files[i])
      }
    }
  } catch {

  }
  return out
}

export function shiftElement(el: Element, dx: number, dy: number): Element {
  return {
    ...el,
    x: el.x + dx,
    y: el.y + dy,
    points: el.points?.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  }
}

export function computePastePlacement(
  clipboard: Element[],
  anchor: Point | null,
  cascade: number,
): Element[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of clipboard) {
    const b = getNormalizedBounds(el)
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.w > maxX) maxX = b.x + b.w
    if (b.y + b.h > maxY) maxY = b.y + b.h
  }
  let dx: number, dy: number
  if (anchor) {
    dx = anchor.x - (minX + maxX) / 2 + cascade
    dy = anchor.y - (minY + maxY) / 2 + cascade
  } else {
    dx = 24 + cascade
    dy = 24 + cascade
  }
  return clipboard.map((el) => ({
    ...shiftElement(el, dx, dy),
    id: generateId(),
  }))
}
