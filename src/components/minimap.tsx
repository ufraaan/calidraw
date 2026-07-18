import { useRef, useEffect, useCallback, useMemo, useState } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setOffset } from '../stores/canvas-store'
import { getNormalizedBounds } from '../lib/geometry'
import type { Element, Point } from '../types'
import type { ReactNode } from 'react'

interface MinimapProps {
  elements: Element[]
}

const W = 172
const H = 116

/** Scale-aware stroke: thin at minimap scale, never thicker than 1px */
function strokeWidth(minimapScale: number, elementStroke: number): number {
  return Math.max(0.35, Math.min(1, elementStroke * minimapScale * 1.2))
}

export function Minimap({ elements }: MinimapProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const offsetX = useSelector(canvasStore, (s) => s.offsetX)
  const offsetY = useSelector(canvasStore, (s) => s.offsetY)
  const dragging = useRef(false)

  // ── Detect dark mode ─────────────────────────────────────────
  const [isDark, setIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── World bounds ─────────────────────────────────────────
  const world = useMemo(() => {
    if (elements.length === 0) return { x: -80, y: -80, w: 160, h: 160 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const el of elements) {
      const b = getNormalizedBounds(el)
      if (b.x < minX) minX = b.x
      if (b.y < minY) minY = b.y
      if (b.x + b.w > maxX) maxX = b.x + b.w
      if (b.y + b.h > maxY) maxY = b.y + b.h
    }
    const pad = Math.max((maxX - minX) * 0.08, 16)
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  }, [elements])

  // ── Layout ───────────────────────────────────────────────
  const pad = 6 // inner padding within the preview area

  // ── Draw ─────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const iw = W * dpr
    const ih = H * dpr

    if (canvas.width !== iw || canvas.height !== ih) {
      canvas.width = iw
      canvas.height = ih
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // ── Panel fill (matches the glass bg so edges look seamless) ──
    ctx.fillStyle = isDark ? '#18181b' : '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // ── Preview background ──────────────────────────────────
    ctx.fillStyle = isDark ? '#27272a' : '#f5f5f4'
    ctx.fillRect(0, 0, W, H)

    const { x: wx, y: wy, w: ww, h: wh } = world
    const avW = W - pad * 2
    const avH = H - pad * 2
    const scale = Math.min(avW / Math.max(ww, 1), avH / Math.max(wh, 1))
    const ox = (W - ww * scale) / 2
    const oy = (H - wh * scale) / 2

    // ── Elements ────────────────────────────────────────────
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (const el of elements) {
      const b = getNormalizedBounds(el)
      const sx = ox + (b.x - wx) * scale
      const sy = oy + (b.y - wy) * scale
      const sw = Math.max(b.w * scale, 2)
      const sh = Math.max(b.h * scale, 2)

      const hasFill = el.backgroundColor !== 'transparent'
      const hasStroke = el.strokeColor !== 'transparent'
      const fill = hasFill ? el.backgroundColor : undefined
      const stroke = hasStroke ? el.strokeColor : '#a1a1aa'

      ctx.save()
      ctx.globalAlpha = Math.min(el.opacity / 100, 0.85)

      if (el.angle !== 0) {
        const cx = sx + sw / 2
        const cy = sy + sh / 2
        ctx.translate(cx, cy)
        ctx.rotate(el.angle)
        ctx.translate(-cx, -cy)
      }

      switch (el.type) {
        case 'rectangle': {
          if (fill) {
            ctx.fillStyle = fill
            ctx.fillRect(sx, sy, sw, sh)
          }
          ctx.strokeStyle = stroke
          ctx.lineWidth = strokeWidth(scale, el.strokeWidth)
          ctx.strokeRect(sx, sy, sw, sh)
          break
        }
        case 'diamond': {
          const cx = sx + sw / 2, cy = sy + sh / 2
          ctx.beginPath()
          ctx.moveTo(cx, sy)
          ctx.lineTo(sx + sw, cy)
          ctx.lineTo(cx, sy + sh)
          ctx.lineTo(sx, cy)
          ctx.closePath()
          if (fill) { ctx.fillStyle = fill; ctx.fill() }
          ctx.strokeStyle = stroke
          ctx.lineWidth = strokeWidth(scale, el.strokeWidth)
          ctx.stroke()
          break
        }
        case 'ellipse': {
          const cx = sx + sw / 2, cy = sy + sh / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, sw / 2, sh / 2, 0, 0, Math.PI * 2)
          if (fill) { ctx.fillStyle = fill; ctx.fill() }
          ctx.strokeStyle = stroke
          ctx.lineWidth = strokeWidth(scale, el.strokeWidth)
          ctx.stroke()
          break
        }
        case 'arrow':
        case 'line': {
          if (!el.points || el.points.length < 2) break
          ctx.strokeStyle = stroke
          ctx.lineWidth = strokeWidth(scale, el.strokeWidth)
          ctx.beginPath()
          const f = el.points[0]
          ctx.moveTo(ox + (f.x - wx) * scale, oy + (f.y - wy) * scale)
          for (let i = 1; i < el.points.length; i++) {
            const p = el.points[i]
            ctx.lineTo(ox + (p.x - wx) * scale, oy + (p.y - wy) * scale)
          }
          ctx.stroke()
          break
        }
        case 'pencil': {
          if (!el.points || el.points.length < 2) break
          ctx.strokeStyle = stroke
          ctx.lineWidth = strokeWidth(scale, el.strokeWidth * 0.6)
          ctx.beginPath()
          const f2 = el.points[0]
          ctx.moveTo(ox + (f2.x - wx) * scale, oy + (f2.y - wy) * scale)
          for (let i = 1; i < el.points.length; i++) {
            const p = el.points[i]
            ctx.lineTo(ox + (p.x - wx) * scale, oy + (p.y - wy) * scale)
          }
          ctx.stroke()
          break
        }
        case 'text':
          ctx.fillStyle = stroke
          ctx.globalAlpha = Math.min(el.opacity / 100, 0.85)
          ctx.fillRect(sx, sy, sw, sh)
          break
        case 'image':
          ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
          ctx.fillRect(sx, sy, sw, sh)
          ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'
          ctx.lineWidth = 0.5
          ctx.strokeRect(sx, sy, sw, sh)
          break
      }
      ctx.restore()
    }

    // ── Viewport indicator ──────────────────────────────────
    const vpX = -offsetX / zoom
    const vpY = -offsetY / zoom
    const vpW = window.innerWidth / zoom
    const vpH = window.innerHeight / zoom

    const rx = ox + (vpX - wx) * scale
    const ry = oy + (vpY - wy) * scale
    const rw = vpW * scale
    const rh = vpH * scale

    ctx.save()
    ctx.fillStyle = 'rgba(232,160,122,0.10)'
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeStyle = 'rgba(232,160,122,0.55)'
    ctx.lineWidth = 1
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.restore()
  }, [elements, zoom, offsetX, offsetY, world, isDark])

  useEffect(() => {
    draw()
  }, [draw])

  // ── Click / drag to navigate ────────────────────────────
  const mmToCanvas = useCallback(
    (mmX: number, mmY: number): Point => {
      const { x: wx, y: wy, w: ww, h: wh } = world
      const avW = W - pad * 2
      const avH = H - pad * 2
      const s = Math.min(avW / Math.max(ww, 1), avH / Math.max(wh, 1))
      const ox = (W - ww * s) / 2
      const oy = (H - wh * s) / 2
      return { x: wx + (mmX - ox) / s, y: wy + (mmY - oy) / s }
    },
    [world],
  )

  const panTo = useCallback(
    (mmX: number, mmY: number) => {
      const pt = mmToCanvas(mmX, mmY)
      const s = canvasStore.state
      setOffset(window.innerWidth / 2 - pt.x * s.zoom, window.innerHeight / 2 - pt.y * s.zoom)
    },
    [mmToCanvas],
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      panTo(e.clientX - rect.left, e.clientY - rect.top)
    },
    [panTo],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      panTo(e.clientX - rect.left, e.clientY - rect.top)
    },
    [panTo],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const glass =
    'bg-white/80 backdrop-blur-xl border border-black/[0.04] shadow-[0_2px_8px_-3px_rgba(0,0,0,0.08)] dark:bg-zinc-900/80 dark:border-white/[0.06] dark:shadow-[0_2px_8px_-3px_rgba(0,0,0,0.3)]'

  return (
    <div
      className={`pointer-events-auto absolute right-4 top-4 z-40 overflow-hidden rounded-[10px] ${glass}`}
    >
      <canvas
        ref={canvasRef}
        className="block cursor-pointer"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
}
