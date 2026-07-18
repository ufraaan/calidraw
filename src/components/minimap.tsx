import { useRef, useEffect, useCallback } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setOffset } from '../stores/canvas-store'
import { getNormalizedBounds } from '../lib/geometry'
import type { Element, Point } from '../types'
import type { ReactNode } from 'react'

interface MinimapProps {
  elements: Element[]
}

const W = 180
const H = 130
const PAD = 8

export function Minimap({ elements }: MinimapProps): ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const offsetX = useSelector(canvasStore, (s) => s.offsetX)
  const offsetY = useSelector(canvasStore, (s) => s.offsetY)
  const dragging = useRef(false)

  // ── Compute world bounds from all elements ────────────────
  const world = getWorldBounds(elements)

  // ── Draw minimap ──────────────────────────────────────────
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

    ctx.clearRect(0, 0, iw, ih)
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.03)'
    ctx.fillRect(0, 0, W, H)

    const { x: wx, y: wy, w: ww, h: wh } = world
    const availableW = W - PAD * 2
    const availableH = H - PAD * 2
    const scale = Math.min(availableW / Math.max(ww, 1), availableH / Math.max(wh, 1))
    const ox = (W - ww * scale) / 2
    const oy = (H - wh * scale) / 2

    // Draw every element as a simplified shape
    ctx.lineWidth = 1
    for (const el of elements) {
      const b = getNormalizedBounds(el)
      const sx = ox + (b.x - wx) * scale
      const sy = oy + (b.y - wy) * scale
      const sw = Math.max(b.w * scale, 2)
      const sh = Math.max(b.h * scale, 2)

      ctx.strokeStyle = el.strokeColor === 'transparent' ? '#888' : el.strokeColor
      ctx.fillStyle = el.backgroundColor !== 'transparent' ? el.backgroundColor : 'transparent'
      ctx.globalAlpha = el.opacity / 100

      // Apply rotation if any
      ctx.save()
      if (el.angle !== 0) {
        const cx = sx + sw / 2
        const cy = sy + sh / 2
        ctx.translate(cx, cy)
        ctx.rotate(el.angle)
        ctx.translate(-cx, -cy)
      }

      switch (el.type) {
        case 'rectangle':
          if (el.backgroundColor !== 'transparent') {
            ctx.fillRect(sx, sy, sw, sh)
          }
          ctx.strokeRect(sx, sy, sw, sh)
          break
        case 'diamond': {
          const dcx = sx + sw / 2
          const dcy = sy + sh / 2
          ctx.beginPath()
          ctx.moveTo(dcx, sy)
          ctx.lineTo(sx + sw, dcy)
          ctx.lineTo(dcx, sy + sh)
          ctx.lineTo(sx, dcy)
          ctx.closePath()
          if (el.backgroundColor !== 'transparent') ctx.fill()
          ctx.stroke()
          break
        }
        case 'ellipse': {
          const ecx = sx + sw / 2
          const ecy = sy + sh / 2
          ctx.beginPath()
          ctx.ellipse(ecx, ecy, sw / 2, sh / 2, 0, 0, Math.PI * 2)
          if (el.backgroundColor !== 'transparent') ctx.fill()
          ctx.stroke()
          break
        }
        case 'arrow':
        case 'line':
          if (el.points && el.points.length >= 2) {
            ctx.beginPath()
            const fp = el.points[0]
            ctx.moveTo(ox + (fp.x - wx) * scale, oy + (fp.y - wy) * scale)
            for (let i = 1; i < el.points.length; i++) {
              const p = el.points[i]
              ctx.lineTo(ox + (p.x - wx) * scale, oy + (p.y - wy) * scale)
            }
            ctx.stroke()
          }
          break
        case 'pencil':
          if (el.points && el.points.length >= 2) {
            ctx.beginPath()
            const fp2 = el.points[0]
            ctx.moveTo(ox + (fp2.x - wx) * scale, oy + (fp2.y - wy) * scale)
            for (let i = 1; i < el.points.length; i++) {
              const p = el.points[i]
              ctx.lineTo(ox + (p.x - wx) * scale, oy + (p.y - wy) * scale)
            }
            ctx.stroke()
          }
          break
        case 'text':
          ctx.fillStyle = el.strokeColor
          ctx.globalAlpha = el.opacity / 100
          ctx.fillRect(sx, sy, sw, sh)
          break
        case 'image':
          ctx.strokeRect(sx, sy, sw, sh)
          ctx.fillStyle = 'rgba(100,100,100,0.2)'
          ctx.fillRect(sx, sy, sw, sh)
          break
      }
      ctx.restore()
      ctx.globalAlpha = 1
    }

    // ── Viewport indicator ───────────────────────────────────
    const vpX = -offsetX / zoom
    const vpY = -offsetY / zoom
    const vpW = window.innerWidth / zoom
    const vpH = window.innerHeight / zoom

    const rx = ox + (vpX - wx) * scale
    const ry = oy + (vpY - wy) * scale
    const rw = vpW * scale
    const rh = vpH * scale

    ctx.save()
    ctx.fillStyle = 'rgba(59, 130, 246, 0.12)'
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)'
    ctx.lineWidth = 1
    ctx.fillRect(rx, ry, rw, rh)
    ctx.strokeRect(rx, ry, rw, rh)
    ctx.restore()
  }, [elements, zoom, offsetX, offsetY, world])

  useEffect(() => {
    draw()
  }, [draw])

  // ── Interaction: click / drag to pan ──────────────────────
  const mmToCanvas = useCallback(
    (mmX: number, mmY: number): Point => {
      const { x: wx, y: wy, w: ww, h: wh } = world
      const availableW = W - PAD * 2
      const availableH = H - PAD * 2
      const scale = Math.min(availableW / Math.max(ww, 1), availableH / Math.max(wh, 1))
      const ox = (W - ww * scale) / 2
      const oy = (H - wh * scale) / 2
      return {
        x: wx + (mmX - ox) / scale,
        y: wy + (mmY - oy) / scale,
      }
    },
    [world],
  )

  const panTo = useCallback((mmX: number, mmY: number) => {
    const pt = mmToCanvas(mmX, mmY)
    const s = canvasStore.state
    const newOffsetX = window.innerWidth / 2 - pt.x * s.zoom
    const newOffsetY = window.innerHeight / 2 - pt.y * s.zoom
    setOffset(newOffsetX, newOffsetY)
  }, [mmToCanvas])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
      panTo(mx, my)
    },
    [panTo],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return
      const rect = e.currentTarget.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      panTo(mx, my)
    },
    [panTo],
  )

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const glass =
    'bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900/70 dark:border-white/[0.06] dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]'

  return (
    <div
      className={`pointer-events-auto absolute right-4 top-4 z-40 overflow-hidden rounded-lg ${glass}`}
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

// ── Helper ─────────────────────────────────────────────────
function getWorldBounds(elements: Element[]) {
  if (elements.length === 0) return { x: -100, y: -100, w: 200, h: 200 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of elements) {
    const b = getNormalizedBounds(el)
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.w > maxX) maxX = b.x + b.w
    if (b.y + b.h > maxY) maxY = b.y + b.h
  }
  const pad = Math.max((maxX - minX) * 0.1, 20)
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}
