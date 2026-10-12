import { useRef, useEffect, useCallback } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setSelectedIds, setOffset, setTool, zoomAtPoint } from '../stores/canvas-store'
import { renderScene, BRAND } from '../lib/renderer'
import { startDrawing, updateDrawing, endDrawing, isShapeTool } from '../lib/tools'
import { LaserPointer } from '@excalidraw/laser-pointer'
import { hitTest, hitTestResizeHandle, getResizedElement, hitTestRotationHandle, getRotationAngle, generateId, getElementBounds, pointInBounds } from '../lib/geometry'
import type { Element, Point, Tool } from '../types'
import type { ResizeHandle } from '../lib/geometry'

interface UseCanvasOptions {
  elements: Element[]
  editingTextId: string | null
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
  laser: 'crosshair',
}

const RESIZE_CURSOR: Record<ResizeHandle, string> = {
  tl: 'nwse-resize',
  tr: 'nesw-resize',
  br: 'nwse-resize',
  bl: 'nesw-resize',
  tm: 'ns-resize',
  rm: 'ew-resize',
  bm: 'ns-resize',
  lm: 'ew-resize',
  start: 'move',
  end: 'crosshair',
}

export function useCanvas({ elements, editingTextId, onElementCreate, onElementsUpdate }: UseCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const tool = useSelector(canvasStore, (s) => s.tool)
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)

  // ── Refs ───────────────────────────────────────────────────
  const elementsRef = useRef(elements)
  const selectedRef = useRef(selectedIds)
  const transientRef = useRef<Element[]>([])
  const dragIdsRef = useRef<Set<string>>(new Set())
  const panStartRef = useRef<Point | null>(null)
  const dragOriginRef = useRef<{ point: Point; elements: Element[] } | null>(null)
  const resizeHandleRef = useRef<ResizeHandle | null>(null)
  const rotatingRef = useRef<string | null>(null)
  const marqueeRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const hoveredElRef = useRef<string | null>(null)
  const cursorPosRef = useRef<Point | null>(null)
  const laserPointsRef = useRef<Point[]>([])
  const rafRef = useRef(0)

  useEffect(() => {
    elementsRef.current = elements
    selectedRef.current = selectedIds
  })

  // ── Direct canvas render ───────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx = ctxRef.current
    if (!ctx) {
      ctx = canvas.getContext('2d')
      if (!ctx) return
      ctxRef.current = ctx
    }
    const s = canvasStore.state
    const dpr = window.devicePixelRatio || 1

    // Base transform (DPR) + world transform. renderScene clears
    // in device pixels and culls against this transform.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.translate(s.offsetX, s.offsetY)
    ctx.scale(s.zoom, s.zoom)

    const hidden = dragIdsRef.current
    const visible = elementsRef.current.filter((e) => !hidden.has(e.id))
    // Build set of selected IDs for rendering
    const sel = new Set(selectedRef.current)

    const all = visible.concat(transientRef.current)
    // When editing text, don't render the element on canvas — it's
    // overlaid by the DOM textarea and would cause visual overlap.
    const toRender = editingTextId
      ? all.filter((el) => el.type !== 'text' || el.id !== editingTextId)
      : all
    renderScene(ctx, toRender, sel, true, s.zoom)

    // Hover highlight (after scene — renderScene clears first)
    if (tool === 'select' && !dragOriginRef.current && !resizeHandleRef.current && hoveredElRef.current) {
      const hov = elementsRef.current.find((e) => e.id === hoveredElRef.current)
      if (hov && !sel.has(hov.id)) {
        const bx = hov.width >= 0 ? hov.x : hov.x + hov.width
        const by = hov.height >= 0 ? hov.y : hov.y + hov.height
        const bw = Math.abs(hov.width)
        const bh = Math.abs(hov.height)
        ctx.save()
        ctx.strokeStyle = 'rgba(232,160,122,0.35)'
        ctx.lineWidth = 1.5 / s.zoom
        ctx.setLineDash([3 / s.zoom, 4 / s.zoom])
        ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6)
        ctx.setLineDash([])
        ctx.restore()
      }
    }

    // Marquee
    const m = marqueeRef.current
    if (m) {
      const rx = Math.min(m.x1, m.x2)
      const ry = Math.min(m.y1, m.y2)
      const rw = Math.abs(m.x2 - m.x1)
      const rh = Math.abs(m.y2 - m.y1)
      ctx.save()
      ctx.fillStyle = 'rgba(232,160,122,0.10)'
      ctx.strokeStyle = BRAND
      ctx.lineWidth = 1.5 / s.zoom
      ctx.setLineDash([4 / s.zoom, 4 / s.zoom])
      ctx.fillRect(rx, ry, rw, rh)
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
      ctx.restore()
    }

    // Dimension label during resize
    if (resizeHandleRef.current && transientRef.current.length === 1 && cursorPosRef.current) {
      const el = transientRef.current[0]
      const w = Math.abs(el.width)
      const h = Math.abs(el.height)
      const label = `${Math.round(w)} × ${Math.round(h)}`
      const cx = cursorPosRef.current.x
      const cy = cursorPosRef.current.y
      ctx.save()
      ctx.font = `11px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      const metrics = ctx.measureText(label)
      const lw = metrics.width + 12
      const lh = 22
      const lx = cx - lw / 2
      const ly = cy - 14
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.beginPath()
      ctx.roundRect(lx, ly, lw, lh, 4)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.fillText(label, cx, ly + lh - 5)
      ctx.restore()
    }

    // Laser pointer trail (no shadowBlur — expensive; fresh instance per frame is fine)
    const laserPts = laserPointsRef.current
    if (laserPts.length >= 2) {
      // Keep only the most recent points — trail has a max visible length.
      const maxTrail = 60
      const recent = laserPts.length > maxTrail
        ? laserPts.slice(laserPts.length - maxTrail)
        : laserPts

      const stroke = new LaserPointer({
        size: 3,
        streamline: 0.35,
        simplify: 0.04,
        keepHead: false,
        sizeMapping: (d) => d.currentIndex / d.totalLength,
      })
      for (const p of recent) {
        stroke.addPoint([p.x, p.y, 1])
      }
      stroke.close()
      const outline = stroke.getStrokeOutline()
      if (outline.length >= 3) {
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(outline[0][0], outline[0][1])
        for (let i = 1; i < outline.length; i++) {
          ctx.lineTo(outline[i][0], outline[i][1])
        }
        ctx.closePath()
        ctx.fillStyle = '#ef4444'
        ctx.fill()
        ctx.restore()
      }
    }
  }, [tool])

  const scheduleDraw = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ── Canvas setup (DPR-aware) ──────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(window.innerWidth * dpr)
      canvas.height = Math.floor(window.innerHeight * dpr)
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctxRef.current = canvas.getContext('2d')
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    draw()
  }, [draw, elements, zoom, selectedIds, tool])

  // ── Wheel ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.01
        const cur = canvasStore.state.zoom
        const newZoom = Math.max(0.1, Math.min(5, cur + delta * cur))
        zoomAtPoint(newZoom, e.clientX, e.clientY)
      } else {
        const cur = canvasStore.state
        setOffset(cur.offsetX - e.deltaX, cur.offsetY - e.deltaY)
      }
      scheduleDraw()
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [scheduleDraw])

  // ── Touch pinch zoom ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let lastDist = 0
    let lastCenter: { x: number; y: number } | null = null

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2) {
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        lastDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        lastCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        if (lastDist > 0 && lastCenter) {
          const scale = dist / lastDist
          const cur = canvasStore.state.zoom
          const newZoom = Math.max(0.1, Math.min(5, cur * scale))
          zoomAtPoint(newZoom, lastCenter.x, lastCenter.y)
        }
        lastDist = dist
        lastCenter = {
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        }
        scheduleDraw()
      }
    }

    function onTouchEnd() {
      lastDist = 0
      lastCenter = null
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [scheduleDraw])

  // ── Cursor ─────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.style.cursor = panStartRef.current ? 'grabbing' : (TOOL_CURSOR[tool] ?? 'default')
  }, [tool])

  // ── Coordinate mapping (reads live store — no stale closures) ─
  const screenToCanvas = useCallback(
    (sx: number, sy: number): Point => {
      const s = canvasStore.state
      return {
        x: (sx - s.offsetX) / s.zoom,
        y: (sy - s.offsetY) / s.zoom,
      }
    },
    [],
  )

  // ── Helper: snapshot selected elements ─────────────────────
  const snapshotSelection = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => elementsRef.current.find((e) => e.id === id))
        .filter((e): e is Element => !!e)
        .map((e) => ({ ...e })),
    [],
  )

  // ── Pointer down ──────────────────────────────────────────
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = screenToCanvas(e.clientX, e.clientY)

      // Middle-click pan
      if (e.button === 1) {
        panStartRef.current = { x: e.clientX, y: e.clientY }
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
        return
      }

      if (tool === 'pan') {
        panStartRef.current = { x: e.clientX, y: e.clientY }
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
        return
      }

      if (tool === 'select') {
        const firstSelected =
          selectedRef.current.length > 0
            ? elementsRef.current.find((el) => el.id === selectedRef.current[0])
            : undefined

        // 1) Rotation handle on first selected element
        if (firstSelected) {
          if (hitTestRotationHandle(point, firstSelected)) {
            rotatingRef.current = firstSelected.id
            dragOriginRef.current = { point, elements: [{ ...firstSelected }] }
            return
          }
        }

        // 2) Resize handles on first selected element
        if (firstSelected) {
          const handle = hitTestResizeHandle(point, firstSelected)
          if (handle) {
            resizeHandleRef.current = handle
            dragOriginRef.current = { point, elements: [{ ...firstSelected }] }
            return
          }
        }

        // 2b) If clicking inside the bounding box of an already-selected
        //     element, drag from anywhere in the box (not just on stroke).
        if (selectedRef.current.length > 0) {
          const selSet = new Set(selectedRef.current)
          let inSelBox: Element | undefined
          for (const el of elementsRef.current) {
            if (selSet.has(el.id) && pointInBounds(point, getElementBounds(el))) {
              inSelBox = el
              break
            }
          }
          if (inSelBox) {
            const snaps = snapshotSelection(selectedRef.current)
            if (snaps.length > 0) {
              dragOriginRef.current = { point, elements: snaps }
            }
            scheduleDraw()
            return
          }
        }

        // 2) Element hit (topmost first — reverse loop, no allocation)
        let hit: Element | undefined
        {
          const arr = elementsRef.current
          for (let i = arr.length - 1; i >= 0; i--) {
            if (hitTest(point, arr[i])) {
              hit = arr[i]
              break
            }
          }
        }
        if (hit) {
          const alreadyInSel = selectedRef.current.includes(hit.id)
          const isMultiSel = selectedRef.current.length > 1

          if (e.altKey) {
            // Alt + drag = duplicate
            const clone: Element = { ...hit, id: generateId() }
            onElementCreate(clone)
            setSelectedIds([clone.id])
            dragOriginRef.current = { point, elements: [{ ...clone }] }
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl/Cmd + click = toggle selection
            const next = alreadyInSel
              ? selectedRef.current.filter((id) => id !== hit.id)
              : [...selectedRef.current, hit.id]
            setSelectedIds(next)
            const snaps = snapshotSelection(next)
            if (snaps.length > 0) {
              dragOriginRef.current = { point, elements: snaps }
            }
          } else if (alreadyInSel && isMultiSel) {
            // Click on element already in multi-selection → drag ALL selected
            const snaps = snapshotSelection(selectedRef.current)
            dragOriginRef.current = { point, elements: snaps }
          } else {
            // Single select + drag
            setSelectedIds([hit.id])
            dragOriginRef.current = { point, elements: [{ ...hit }] }
          }
        } else {
          // 3) Empty space → marquee
          marqueeRef.current = { x1: point.x, y1: point.y, x2: point.x, y2: point.y }
          setSelectedIds([])
        }
        scheduleDraw()
        return
      }

      if (tool === 'text') {
        const state = canvasStore.state
        const el: Element = {
          id: generateId(),
          type: 'text',
          x: point.x,
          y: point.y,
          width: 100,
          height: 24,
          angle: 0,
          strokeColor: state.strokeColor,
          backgroundColor: 'transparent',
          strokeWidth: 0,
          strokeStyle: 'solid',
          roughness: 0,
          bowing: 0,
          opacity: state.opacity,
          text: '',
          fontFamily: state.fontFamily,
          fontSize: state.fontSize,
        }
        onElementCreate(el)
        // Auto-switch to select so the text editor can take focus
        setTool('select')
        return
      }

      if (tool === 'laser') {
        laserPointsRef.current = [point]
        transientRef.current = []
        scheduleDraw()
        return
      }

      if (isShapeTool(tool as Tool)) {
        startDrawing(point)
      }
    },
    [tool, screenToCanvas, scheduleDraw, onElementCreate, snapshotSelection],
  )

  // ── Pointer move ──────────────────────────────────────────
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const point = screenToCanvas(e.clientX, e.clientY)
      cursorPosRef.current = point

      // Pan
      if (panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x
        const dy = e.clientY - panStartRef.current.y
        const cur = canvasStore.state
        setOffset(cur.offsetX + dx, cur.offsetY + dy)
        panStartRef.current = { x: e.clientX, y: e.clientY }
        scheduleDraw()
        return
      }

      // Marquee
      if (marqueeRef.current) {
        marqueeRef.current.x2 = point.x
        marqueeRef.current.y2 = point.y
        scheduleDraw()
        return
      }

      // Rotation
      if (rotatingRef.current && dragOriginRef.current) {
        const { elements: els } = dragOriginRef.current
        const angle = getRotationAngle(els[0], point)
        dragIdsRef.current = new Set([els[0].id])
        transientRef.current = [{ ...els[0], angle }]
        scheduleDraw()
        return
      }

      // Resize
      if (resizeHandleRef.current && dragOriginRef.current) {
        const { elements: els } = dragOriginRef.current
        const aspectLock = e.shiftKey
        const resized = getResizedElement(els[0], resizeHandleRef.current, point, aspectLock)
        dragIdsRef.current = new Set([els[0].id])
        transientRef.current = [resized]
        scheduleDraw()
        return
      }

      // Drag
      if (dragOriginRef.current) {
        const { point: startPoint, elements: els } = dragOriginRef.current
        const dx = point.x - startPoint.x
        const dy = point.y - startPoint.y
        dragIdsRef.current = new Set(els.map((el) => el.id))
        transientRef.current = els.map((el) => ({
          ...el,
          x: el.x + dx,
          y: el.y + dy,
          points: el.points ? el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) : undefined,
        }))
        scheduleDraw()
        return
      }

      // Hover detection + cursor (select tool only)
      if (tool === 'select') {
        const firstSelected =
          selectedRef.current.length > 0
            ? elementsRef.current.find((el) => el.id === selectedRef.current[0])
            : undefined
        let cursorSet = false

        if (firstSelected && selectedRef.current.length === 1) {
          // Rotation handle cursor (takes priority)
          if (hitTestRotationHandle(point, firstSelected)) {
            if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
            cursorSet = true
          }
        }

        if (!cursorSet && firstSelected && selectedRef.current.length === 1) {
          const handle = hitTestResizeHandle(point, firstSelected)
          if (handle) {
            if (canvasRef.current) canvasRef.current.style.cursor = RESIZE_CURSOR[handle]
            cursorSet = true
          }
        }

        if (!cursorSet) {
          // Hover highlight (reverse loop, no allocation)
          let hit: Element | undefined
          {
            const arr = elementsRef.current
            for (let i = arr.length - 1; i >= 0; i--) {
              if (hitTest(point, arr[i])) {
                hit = arr[i]
                break
              }
            }
          }
          if (hit) {
            hoveredElRef.current = hit.id
            // Show move cursor when hovering an element
            if (canvasRef.current) canvasRef.current.style.cursor = 'move'
            scheduleDraw()
          } else {
            if (hoveredElRef.current) {
              hoveredElRef.current = null
              scheduleDraw()
            }
            if (canvasRef.current) canvasRef.current.style.cursor = 'default'
          }
        }
      }

      // Laser pointer trail
      if (tool === 'laser' && laserPointsRef.current.length > 0) {
        laserPointsRef.current.push(point)
        // Keep the buffer bounded
        if (laserPointsRef.current.length > 200) {
          laserPointsRef.current = laserPointsRef.current.slice(-100)
        }
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

  // ── Pointer up ────────────────────────────────────────────
  const handlePointerUp = useCallback(
    (_e: React.PointerEvent<HTMLCanvasElement>) => {
      panStartRef.current = null
      if (canvasRef.current) {
        canvasRef.current.style.cursor = TOOL_CURSOR[tool] ?? 'default'
      }

      // Marquee
      if (marqueeRef.current) {
        const { x1, y1, x2, y2 } = marqueeRef.current
        marqueeRef.current = null
        const mx = Math.min(x1, x2)
        const my = Math.min(y1, y2)
        const mw = Math.abs(x2 - x1)
        const mh = Math.abs(y2 - y1)
        if (mw >= 5 || mh >= 5) {
          const inside = elementsRef.current.filter((el) => {
            const bx = el.width >= 0 ? el.x : el.x + el.width
            const by = el.height >= 0 ? el.y : el.y + el.height
            const bw = Math.abs(el.width)
            const bh = Math.abs(el.height)
            return mx < bx + bw && mx + mw > bx && my < by + bh && my + mh > by
          })
          setSelectedIds(inside.map((e) => e.id))
        }
        scheduleDraw()
        return
      }

      // Rotation
      if (rotatingRef.current) {
        const moved = transientRef.current
        rotatingRef.current = null
        dragOriginRef.current = null
        dragIdsRef.current = new Set()
        transientRef.current = []
        if (moved.length > 0) onElementsUpdate(moved)
        return
      }

      // Resize
      if (resizeHandleRef.current) {
        const moved = transientRef.current
        resizeHandleRef.current = null
        dragOriginRef.current = null
        dragIdsRef.current = new Set()
        transientRef.current = []
        if (moved.length > 0) onElementsUpdate(moved)
        return
      }

      // Drag (multi-element supported)
      if (dragOriginRef.current) {
        const moved = transientRef.current
        dragOriginRef.current = null
        dragIdsRef.current = new Set()
        transientRef.current = []
        if (moved.length > 0) onElementsUpdate(moved)
        return
      }

      // Laser pointer — never commits to elements
      if (tool === 'laser') {
        transientRef.current = []
        laserPointsRef.current = []
        scheduleDraw()
        return
      }

      // Drawing complete — auto-switch to select, except pencil
      // (pencil stays on itself so you can sketch consecutive strokes)
      if (isShapeTool(tool as Tool)) {
        transientRef.current = []
        scheduleDraw()
        const el = endDrawing()
        if (el) {
          onElementCreate(el)
          if (tool !== 'pencil') {
            setTool('select')
          }
        }
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
