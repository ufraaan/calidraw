import rough from 'roughjs'
import type { RoughCanvas } from 'roughjs/bin/canvas'
import type { Element, Point } from '../types'

// ── Image cache ─────────────────────────────────────────────
const imageCache = new Map<string, HTMLImageElement>()

function getOrCreateImage(dataUrl: string): HTMLImageElement {
  let img = imageCache.get(dataUrl)
  if (!img) {
    img = new Image()
    img.src = dataUrl
    imageCache.set(dataUrl, img)
  }
  return img
}

// ── Seed ─────────────────────────────────────────────────────
function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h) + id.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

// ── Draw options ─────────────────────────────────────────────
function getDrawOptions(element: Element) {
  return {
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    seed: seedFromId(element.id),
    strokeLineDash:
      element.strokeStyle === 'dashed'
        ? [8, 8]
        : element.strokeStyle === 'dotted'
          ? [2, 2]
          : undefined,
    fill:
      element.backgroundColor === 'transparent'
        ? undefined
        : element.backgroundColor,
    fillStyle: 'solid' as const,
  }
}

// ── Shape renderers ──────────────────────────────────────────
function renderRectangle(rc: RoughCanvas, el: Element) {
  const options = getDrawOptions(el)
  const x = el.width >= 0 ? el.x : el.x + el.width
  const y = el.height >= 0 ? el.y : el.y + el.height
  const w = Math.abs(el.width)
  const h = Math.abs(el.height)
  rc.rectangle(x, y, w, h, options)
}

function renderDiamond(rc: RoughCanvas, el: Element) {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const hw = Math.abs(el.width) / 2
  const hh = Math.abs(el.height) / 2
  const points: Point[] = [
    { x: cx, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx, y: cy + hh },
    { x: cx - hw, y: cy },
  ]
  rc.polygon(
    points.map((p) => [p.x, p.y] as [number, number]),
    getDrawOptions(el),
  )
}

function renderEllipse(rc: RoughCanvas, el: Element) {
  const cx = el.x + el.width / 2
  const cy = el.y + el.height / 2
  const hw = Math.abs(el.width) / 2
  const hh = Math.abs(el.height) / 2
  rc.ellipse(cx, cy, hw * 2, hh * 2, getDrawOptions(el))
}

function renderArrow(rc: RoughCanvas, el: Element) {
  const fromX = el.x
  const fromY = el.y
  const toX = el.x + el.width
  const toY = el.y + el.height
  rc.line(fromX, fromY, toX, toY, getDrawOptions(el))

  const angle = Math.atan2(toY - fromY, toX - fromX)
  const headLen = 10 + el.strokeWidth * 2
  const headAngle = Math.PI / 6

  const headX1 = toX - headLen * Math.cos(angle - headAngle)
  const headY1 = toY - headLen * Math.sin(angle - headAngle)
  const headX2 = toX - headLen * Math.cos(angle + headAngle)
  const headY2 = toY - headLen * Math.sin(angle + headAngle)

  rc.line(toX, toY, headX1, headY1, getDrawOptions(el))
  rc.line(toX, toY, headX2, headY2, getDrawOptions(el))
}

function renderLine(rc: RoughCanvas, el: Element) {
  if (!el.points || el.points.length < 2) return
  const pts = el.points.map((p) => [p.x, p.y] as [number, number])
  rc.linearPath(pts, getDrawOptions(el))
}

function renderPencil(rc: RoughCanvas, el: Element) {
  if (!el.points || el.points.length < 2) return
  const pts = el.points.map((p) => [p.x, p.y] as [number, number])
  rc.linearPath(pts, {
    ...getDrawOptions(el),
    roughness: 0.5,
    strokeWidth: el.strokeWidth * 0.5,
  })
}

function renderText(ctx: CanvasRenderingContext2D, el: Element) {
  if (!el.text) return
  ctx.save()
  ctx.font = `${el.fontSize ?? 20}px ${el.fontFamily ?? 'sans-serif'}`
  ctx.fillStyle = el.strokeColor
  ctx.globalAlpha = el.opacity / 100
  ctx.fillText(el.text, el.x, el.y)
  ctx.restore()
}

function renderImage(ctx: CanvasRenderingContext2D, el: Element) {
  if (!el.imageData) return
  const img = getOrCreateImage(el.imageData)
  if (!img.complete) return
  const x = el.width >= 0 ? el.x : el.x + el.width
  const y = el.height >= 0 ? el.y : el.y + el.height
  const w = Math.abs(el.width)
  const h = Math.abs(el.height)
  ctx.save()
  ctx.globalAlpha = el.opacity / 100
  ctx.drawImage(img, x, y, w, h)
  ctx.restore()
}

// ── Scene ────────────────────────────────────────────────────
export function renderScene(
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  selectedIds: Set<string>,
) {
  const canvas = ctx.canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const rc = rough.canvas(canvas)

  for (const el of elements) {
    ctx.save()
    ctx.globalAlpha = el.opacity / 100

    switch (el.type) {
      case 'rectangle':
        renderRectangle(rc, el)
        break
      case 'diamond':
        renderDiamond(rc, el)
        break
      case 'ellipse':
        renderEllipse(rc, el)
        break
      case 'arrow':
        renderArrow(rc, el)
        break
      case 'line':
        renderLine(rc, el)
        break
      case 'pencil':
        renderPencil(rc, el)
        break
      case 'text':
        renderText(ctx, el)
        break
      case 'image':
        renderImage(ctx, el)
        break
    }

    ctx.restore()

    if (selectedIds.has(el.id)) {
      renderSelectionIndicator(ctx, el)
    }
  }
}

// ── Selection indicator ──────────────────────────────────────
function renderSelectionIndicator(
  ctx: CanvasRenderingContext2D,
  el: Element,
) {
  const x = el.width >= 0 ? el.x : el.x + el.width
  const y = el.height >= 0 ? el.y : el.y + el.height
  const w = Math.abs(el.width)
  const h = Math.abs(el.height)

  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.strokeRect(x - 2, y - 2, w + 4, h + 4)
  ctx.setLineDash([])
  ctx.restore()

  // Resize handles
  const half = 4
  const corners: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ]

  ctx.save()
  for (const p of corners) {
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.5
    ctx.fillRect(p.x - half, p.y - half, half * 2, half * 2)
    ctx.strokeRect(p.x - half, p.y - half, half * 2, half * 2)
  }
  ctx.restore()
}

// ── Offscreen render for export / clipboard ──────────────────
export function renderElementsToCanvas(
  elements: Element[],
  selectedIds: Set<string>,
): HTMLCanvasElement {
  // Compute bounding box
  if (elements.length === 0) {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of elements) {
    const ex = el.width >= 0 ? el.x : el.x + el.width
    const ey = el.height >= 0 ? el.y : el.y + el.height
    const ew = Math.abs(el.width)
    const eh = Math.abs(el.height)
    if (ex < minX) minX = ex
    if (ey < minY) minY = ey
    if (ex + ew > maxX) maxX = ex + ew
    if (ey + eh > maxY) maxY = ey + eh
  }

  const pad = 20
  const w = Math.ceil(maxX - minX + pad * 2)
  const h = Math.ceil(maxY - minY + pad * 2)

  const canvas = document.createElement('canvas')
  canvas.width = w * 2 // 2x for retina
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  ctx.translate(-minX + pad, -minY + pad)

  renderScene(ctx, elements, selectedIds)
  return canvas
}

export async function copyToClipboardAsPNG(elements: Element[], ids: string[]) {
  const toRender = ids.length > 0
    ? elements.filter((e) => ids.includes(e.id))
    : elements
  const canvas = renderElementsToCanvas(toRender, new Set(ids))
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) return
  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob }),
  ])
}

export function downloadAsPNG(elements: Element[], ids: string[], filename: string) {
  const toRender = ids.length > 0
    ? elements.filter((e) => ids.includes(e.id))
    : elements
  const canvas = renderElementsToCanvas(toRender, new Set(ids))
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}
