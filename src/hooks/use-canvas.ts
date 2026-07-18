import { useRef, useEffect, useCallback } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setSelectedIds, setOffset, setZoom } from '../stores/canvas-store'
import { renderScene } from '../lib/renderer'
import { startDrawing, updateDrawing, endDrawing, isShapeTool } from '../lib/tools'
import { hitTest } from '../lib/geometry'
import type { Element, Point, Tool } from '../types'

interface UseCanvasOptions {
  elements: Element[]
  onElementCreate: (element: Element) => void
  onElementsUpdate: (elements: Element[]) => void
}

const TOOL_CURSOR: Record<string, string> = {
  select: 'default',
  rectangle: 'crosshair',
  diamond: 'crosshair',
  ellipse: 'crosshair',
  arrow: 'crosshair',
  line: 'crosshair',
  pencil: 'crosshair',
  text: 'text',
  pan: 'grab',
}

export function useCanvas({ elements, onElementCreate, onElementsUpdate }: UseCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tool = useSelector(canvasStore, (s) => s.tool)
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const offsetX = useSelector(canvasStore, (s) => s.offsetX)
  const offsetY = useSelector(canvasStore, (s) => s.offsetY)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)

  // ── Refs (transient render state — avoids React re-renders) ──
  const elementsRef = useRef(elements)
  const selectedRef = useRef(selectedIds)
  const transientRef = useRef<Element[]>([])
  const dragIdsRef = useRef<Set<string>>(new Set())
  const panStartRef = useRef<Point | null>(null)
  const dragOriginRef = useRef<{ point: Point; el: Element } | null>(null)
  const rafRef = useRef(0)

  elementsRef.current = elements
  selectedRef.current = selectedIds

  // ── Direct canvas render (avoids React re-render latency) ─────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const s = canvasStore.state

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.translate(s.offsetX, s.offsetY)
    ctx.scale(s.zoom, s.zoom)

    const hidden = dragIdsRef.current
    const visible = elementsRef.current.filter((e) => !hidden.has(e.id))
    const all = visible.concat(transientRef.current)
    renderScene(ctx, all, new Set(selectedRef.current))
    ctx.restore()
  }, [])

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ── Canvas setup ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  // ── Re-render when committed state changes ────────────────────
  useEffect(() => {
    draw()
  }, [draw, elements, offsetX, offsetY, selectedIds, tool])

  // ── Wheel: trackpad pan / ctrl+zoom ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()

      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01
        const cur = canvasStore.state.zoom
        setZoom(Math.max(0.1, Math.min(5, cur + delta * cur)))
      } else {
        const cur = canvasStore.state
        setOffset(cur.offsetX - e.deltaX, cur.offsetY - e.deltaY)
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  // ── Cursor ────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.cursor = panStartRef.current ? 'grabbing' : (TOOL_CURSOR[tool] ?? 'default')
  }, [tool])

  // ── Coordinate mapping ────────────────────────────────────────
  const screenToCanvas = useCallback(
    (sx: number, sy: number): Point => ({
      x: (sx - offsetX) / zoom,
      y: (sy - offsetY) / zoom,
    }),
    [zoom, offsetX, offsetY],
  )

  // ── Pointer down ──────────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = screenToCanvas(e.clientX, e.clientY)

      if (tool === 'pan') {
        panStartRef.current = { x: e.clientX, y: e.clientY }
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
        return
      }

      if (tool === 'select') {
        const hit = [...elementsRef.current].reverse().find((el) => hitTest(point, el))
        if (hit) {
          setSelectedIds([hit.id])
          dragOriginRef.current = { point, el: { ...hit } }
        } else {
          setSelectedIds([])
        }
        return
      }

      if (isShapeTool(tool as Tool)) {
        startDrawing(point)
      }
    },
    [tool, screenToCanvas],
  )

  // ── Pointer move ──────────────────────────────────────────────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = screenToCanvas(e.clientX, e.clientY)

      // Pan
      if (panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        const cur = canvasStore.state
        setOffset(cur.offsetX + dx, cur.offsetY + dy)
        panStartRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      // Drag shape
      if (dragOriginRef.current) {
        const { point: startPoint, el } = dragOriginRef.current
        const dx = point.x - startPoint.x
        const dy = point.y - startPoint.y
        dragIdsRef.current = new Set([el.id])
        transientRef.current = [{ ...el, x: el.x + dx, y: el.y + dy }]
        scheduleDraw()
        return
      }

      // Drawing preview
      if (isShapeTool(tool as Tool)) {
        const partial = updateDrawing(point)
        if (partial && partial.type) {
          transientRef.current = [
            { id: 'preview', ...partial, angle: 0, opacity: partial.opacity ?? 100 } as Element,
          ]
        } else {
          transientRef.current = []
        }
        scheduleDraw()
      }
    },
    [tool, screenToCanvas, scheduleDraw],
  )

  // ── Pointer up ────────────────────────────────────────────────
  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<HTMLCanvasElement>) => {
      panStartRef.current = null
      if (canvasRef.current) {
        canvasRef.current.style.cursor = TOOL_CURSOR[tool] ?? 'default'
      }

      // Commit drag
      if (dragOriginRef.current) {
        const moved = transientRef.current
        dragOriginRef.current = null
        dragIdsRef.current = new Set()
        transientRef.current = []
        if (moved.length > 0) onElementsUpdate(moved)
        return
      }

      // Commit drawing
      if (isShapeTool(tool as Tool)) {
        transientRef.current = []
        scheduleDraw()
        const el = endDrawing()
        if (el) onElementCreate(el)
      }
    },
    [tool, onElementCreate, onElementsUpdate, scheduleDraw],
  )

  return {
    canvasRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  }
}
