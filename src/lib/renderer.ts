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

// ── Brand accent ─────────────────────────────────────────────
export const BRAND = '#e8a07a'

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
export function getDrawOptions(element: Element) {
  return {
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: element.roughness,
    bowing: element.bowing,
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

// ── Shape renderers (canvas) ─────────────────────────────────
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
    roughness: 0.1,
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

// ── Scene (canvas) ───────────────────────────────────────────
export function renderScene(
  ctx: CanvasRenderingContext2D,
  elements: Element[],
  selectedIds: Set<string>,
  showSelection = true,
  zoom = 1,
) {
  const canvas = ctx.canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const rc = rough.canvas(canvas)

  for (const el of elements) {
    ctx.save()
    ctx.globalAlpha = el.opacity / 100

    // Rotation
    if (el.angle !== 0) {
      const b = getCenter(el)
      ctx.translate(b.cx, b.cy)
      ctx.rotate(el.angle)
      ctx.translate(-b.cx, -b.cy)
    }

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
  }

  // Selection indicators (draw on top, after all elements)
  if (showSelection) {
    for (const el of elements) {
      if (selectedIds.has(el.id)) {
        renderSelectionIndicator(ctx, el, zoom)
      }
    }
  }
}

// ── Selection indicator ──────────────────────────────────────
function renderSelectionIndicator(
  ctx: CanvasRenderingContext2D,
  el: Element,
  zoom = 1,
) {
  const s = 1 / zoom // scale-down factor to keep screen-size constant
  const b = getCenter(el)
  const x = el.width >= 0 ? el.x : el.x + el.width
  const y = el.height >= 0 ? el.y : el.y + el.height
  const w = Math.abs(el.width)
  const h = Math.abs(el.height)

  // Apply rotation to selection indicator too
  ctx.save()
  if (el.angle !== 0) {
    ctx.translate(b.cx, b.cy)
    ctx.rotate(el.angle)
    ctx.translate(-b.cx, -b.cy)
  }

  ctx.strokeStyle = BRAND
  ctx.lineWidth = 1 * s
  ctx.setLineDash([3 * s, 4 * s])
  ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s)
  ctx.setLineDash([])

  const r = 3 * s
  const pts: Point[] = [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ]

  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 1.5 * s
  for (const p of pts) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  // ── Rotation handle ───────────────────────────────────────
  const rotX = x + w / 2
  const rotY = y - 24 * s
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 1 * s
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(rotX, rotY + 10 * s)
  ctx.lineTo(rotX, y)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(rotX, rotY, 4 * s, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.strokeStyle = BRAND
  ctx.lineWidth = 1.5 * s
  ctx.stroke()

  ctx.restore()
}

// ── Offscreen canvas render (PNG export) ─────────────────────
export function renderElementsToCanvas(
  elements: Element[],
  scale = 2,
): HTMLCanvasElement {
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
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.translate(-minX + pad, -minY + pad)

  renderScene(ctx, elements, new Set(), false)
  return canvas
}

export async function copyToClipboardAsPNG(elements: Element[], ids: string[]) {
  const toRender =
    ids.length > 0 ? elements.filter((e) => ids.includes(e.id)) : elements
  const canvas = renderElementsToCanvas(toRender, 2)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  )
  if (!blob) return
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function downloadAsPNG(
  elements: Element[],
  ids: string[],
  filename: string,
  scale = 2,
) {
  const toRender =
    ids.length > 0 ? elements.filter((e) => ids.includes(e.id)) : elements
  const canvas = renderElementsToCanvas(toRender, scale)
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

// ── Rotation center helper ──────────────────────────────────
function getCenter(el: Element) {
  const x = el.width >= 0 ? el.x : el.x + el.width
  const y = el.height >= 0 ? el.y : el.y + el.height
  const w = Math.abs(el.width)
  const h = Math.abs(el.height)
  return { cx: x + w / 2, cy: y + h / 2 }
}

// ── SVG export ───────────────────────────────────────────────
function renderSVGElement(
  rc: ReturnType<typeof rough.svg>,
  el: Element,
  container: Node,
) {
  const options = getDrawOptions(el)

  switch (el.type) {
    case 'rectangle': {
      const x = el.width >= 0 ? el.x : el.x + el.width
      const y = el.height >= 0 ? el.y : el.y + el.height
      const w = Math.abs(el.width)
      const h = Math.abs(el.height)
      const node = rc.rectangle(x, y, w, h, options)
      container.appendChild(node)
      break
    }
    case 'diamond': {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const hw = Math.abs(el.width) / 2
      const hh = Math.abs(el.height) / 2
      const pts: [number, number][] = [
        [cx, cy - hh],
        [cx + hw, cy],
        [cx, cy + hh],
        [cx - hw, cy],
      ]
      const node = rc.polygon(pts, options)
      container.appendChild(node)
      break
    }
    case 'ellipse': {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const hw = Math.abs(el.width) / 2
      const hh = Math.abs(el.height) / 2
      const node = rc.ellipse(cx, cy, hw * 2, hh * 2, options)
      container.appendChild(node)
      break
    }
    case 'arrow': {
      const fromX = el.x
      const fromY = el.y
      const toX = el.x + el.width
      const toY = el.y + el.height
      let node = rc.line(fromX, fromY, toX, toY, options)
      container.appendChild(node)

      const angle = Math.atan2(toY - fromY, toX - fromX)
      const headLen = 10 + el.strokeWidth * 2
      const headAngle = Math.PI / 6
      const hx1 = toX - headLen * Math.cos(angle - headAngle)
      const hy1 = toY - headLen * Math.sin(angle - headAngle)
      const hx2 = toX - headLen * Math.cos(angle + headAngle)
      const hy2 = toY - headLen * Math.sin(angle + headAngle)
      node = rc.line(toX, toY, hx1, hy1, options)
      container.appendChild(node)
      node = rc.line(toX, toY, hx2, hy2, options)
      container.appendChild(node)
      break
    }
    case 'line': {
      if (!el.points || el.points.length < 2) break
      const pts = el.points.map((p) => [p.x, p.y] as [number, number])
      const node = rc.linearPath(pts, options)
      container.appendChild(node)
      break
    }
    case 'pencil': {
      if (!el.points || el.points.length < 2) break
      const pts = el.points.map((p) => [p.x, p.y] as [number, number])
      const node = rc.linearPath(pts, {
        ...options,
        roughness: 0.1,
        strokeWidth: el.strokeWidth * 0.5,
      })
      container.appendChild(node)
      break
    }
    case 'text': {
      if (!el.text) break
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('x', String(el.x))
      text.setAttribute('y', String(el.y))
      text.setAttribute('fill', el.strokeColor)
      text.setAttribute('font-size', String(el.fontSize ?? 20))
      text.setAttribute('font-family', el.fontFamily ?? 'sans-serif')
      text.setAttribute('opacity', String(el.opacity / 100))
      text.textContent = el.text
      container.appendChild(text)
      break
    }
    case 'image': {
      if (!el.imageData) break
      const x = el.width >= 0 ? el.x : el.x + el.width
      const y = el.height >= 0 ? el.y : el.y + el.height
      const w = Math.abs(el.width)
      const h = Math.abs(el.height)
      const img = document.createElementNS('http://www.w3.org/2000/svg', 'image')
      img.setAttribute('x', String(x))
      img.setAttribute('y', String(y))
      img.setAttribute('width', String(w))
      img.setAttribute('height', String(h))
      img.setAttribute('href', el.imageData)
      img.setAttribute('opacity', String(el.opacity / 100))
      container.appendChild(img)
      break
    }
  }
}

export function renderToSVGString(elements: Element[], ids: string[]): string {
  const toRender =
    ids.length > 0 ? elements.filter((e) => ids.includes(e.id)) : elements

  if (toRender.length === 0) return ''

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of toRender) {
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
  const svgW = Math.ceil(maxX - minX + pad * 2)
  const svgH = Math.ceil(maxY - minY + pad * 2)

  const xmlns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(xmlns, 'svg')
  svg.setAttribute('width', String(svgW))
  svg.setAttribute('height', String(svgH))
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`)
  svg.setAttribute('xmlns', xmlns)

  const rc = rough.svg(svg)

  // Wrapping group for coordinate transform
  const g = document.createElementNS(xmlns, 'g')
  g.setAttribute('transform', `translate(${-minX + pad}, ${-minY + pad})`)
  svg.appendChild(g)

  for (const el of toRender) {
    renderSVGElement(rc, el, g)
  }

  // Remove any children rough.js added directly to <svg>
  while (svg.firstChild && svg.firstChild !== g) {
    svg.removeChild(svg.firstChild)
  }

  return new XMLSerializer().serializeToString(svg)
}

export function downloadAsSVG(elements: Element[], ids: string[], filename: string) {
  const svgStr = renderToSVGString(elements, ids)
  if (!svgStr) return
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
