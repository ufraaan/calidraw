import { useState, useCallback, useEffect } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setSelectedIds } from '../stores/canvas-store'
import { useElements } from '../hooks/use-elements'
import {
  useKeyboard,
  setClipboardActions,
  clipboardElements,
  copyToClipboard as copyToInternalClipboard,
} from '../hooks/use-keyboard'
import { useCanvas } from '../hooks/use-canvas'
import { Toolbar } from './toolbar'
import { ZoomControl } from './zoom-control'
import { ContextMenu, MenuItem, MenuSeparator } from './context-menu'
import { copyToClipboardAsPNG, downloadAsPNG } from '../lib/renderer'
import { generateId, getNormalizedBounds } from '../lib/geometry'
import { IconPhoto, IconDownload } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { Element } from '../types'

const p = { size: 18, stroke: 1.5 }

export function CanvasView(): ReactNode {
  const {
    elements,
    upsertElement,
    upsertElements,
    deleteElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  } = useElements()

  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  useKeyboard()

  // ── Context menu state ────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{
    x: number
    y: number
  } | null>(null)

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // ── Canvas handlers ───────────────────────────────────────
  const { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useCanvas({
      elements,
      onElementCreate: upsertElement,
      onElementsUpdate: upsertElements,
    })

  // ── Multi-select: ctrl/cmd+click toggle ───────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      closeCtxMenu()
      handlePointerDown(e)
    },
    [handlePointerDown, closeCtxMenu],
  )

  // ── Right-click → context menu ────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.stopPropagation()

      // Convert client coords to canvas coords
      const s = canvasStore.state
      const cx = (e.clientX - s.offsetX) / s.zoom
      const cy = (e.clientY - s.offsetY) / s.zoom

      // Hit-test elements (top-most first)
      const hit = [...elements].reverse().find((el) => {
        const b = getNormalizedBounds(el)
        return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h
      })

      if (hit) {
        // If the clicked element isn't selected, select only it
        if (!selectedIds.includes(hit.id)) {
          setSelectedIds([hit.id])
        }
      } else {
        // Clicked empty space → deselect all
        setSelectedIds([])
      }

      setCtxMenu({ x: e.clientX, y: e.clientY })
    },
    [elements, selectedIds],
  )

  // ── Clipboard actions ─────────────────────────────────────
  const handleCopy = useCallback(() => {
    if (selectedIds.length === 0) return
    const sel = elements.filter((e) => selectedIds.includes(e.id))
    copyToInternalClipboard(sel)
    closeCtxMenu()
  }, [elements, selectedIds, closeCtxMenu])

  const handleCut = useCallback(() => {
    if (selectedIds.length === 0) return
    const sel = elements.filter((e) => selectedIds.includes(e.id))
    copyToInternalClipboard(sel)
    deleteElements(selectedIds)
    setSelectedIds([])
    closeCtxMenu()
  }, [elements, selectedIds, deleteElements, closeCtxMenu])

  const handlePaste = useCallback(() => {
    if (clipboardElements.length === 0) return
    // Paste at viewport center
    const s = canvasStore.state
    const cx = (window.innerWidth / 2 - s.offsetX) / s.zoom
    const cy = (window.innerHeight / 2 - s.offsetY) / s.zoom

    const pasted = clipboardElements.map((el, i) => ({
      ...el,
      id: generateId(),
      x: el.x + cx - 50 + i * 20,
      y: el.y + cy - 50 + i * 20,
    }))
    upsertElements(pasted)
    setSelectedIds(pasted.map((e) => e.id))
    closeCtxMenu()
  }, [closeCtxMenu, upsertElements])

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return
    deleteElements(selectedIds)
    setSelectedIds([])
    closeCtxMenu()
  }, [selectedIds, deleteElements, closeCtxMenu])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    deleteElements(selectedIds)
    setSelectedIds([])
  }, [selectedIds, deleteElements])

  // Set clipboard actions for keyboard shortcuts
  useEffect(() => {
    setClipboardActions({
      copy: handleCopy,
      cut: handleCut,
      paste: handlePaste,
      deleteSelected: handleDeleteSelected,
    })
  }, [handleCopy, handleCut, handlePaste, handleDeleteSelected])

  // ── Clipboard paste (images from system) ──────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue

          const reader = new FileReader()
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string
            const img = new Image()
            img.onload = () => {
              const s = canvasStore.state
              const vpCx = (window.innerWidth / 2 - s.offsetX) / s.zoom
              const vpCy = (window.innerHeight / 2 - s.offsetY) / s.zoom
              const scale = Math.min(
                400 / img.width,
                400 / img.height,
                1,
              )
              const w = img.width * scale
              const h = img.height * scale

              const el: Element = {
                id: generateId(),
                type: 'image',
                x: vpCx - w / 2,
                y: vpCy - h / 2,
                width: w,
                height: h,
                angle: 0,
                strokeColor: 'transparent',
                backgroundColor: 'transparent',
                strokeWidth: 0,
                strokeStyle: 'solid',
                roughness: 0,
                opacity: 100,
                imageData: dataUrl,
              }
              upsertElement(el)
              setSelectedIds([el.id])
            }
            img.src = dataUrl
          }
          reader.readAsDataURL(file)
        }
      }
    }

    canvas.addEventListener('paste', onPaste)
    return () => canvas.removeEventListener('paste', onPaste)
  }, [canvasRef, upsertElement])

  // ── Context menu actions ──────────────────────────────────
  const selectedElement =
    selectedIds.length === 1
      ? elements.find((e) => e.id === selectedIds[0]) ?? null
      : null

  const flipHorizontal = useCallback(() => {
    if (!selectedElement) return
    const el = selectedElement
    const cx = el.x + el.width / 2
    const newEl: Element = {
      ...el,
      x: cx - el.width / 2,
      width: -el.width,
    }
    // Mirror points for line/pencil
    if (newEl.points) {
      newEl.points = newEl.points.map((p) => ({
        x: cx + (cx - p.x),
        y: p.y,
      }))
    }
    upsertElement(newEl)
    closeCtxMenu()
  }, [selectedElement, upsertElement, closeCtxMenu])

  const flipVertical = useCallback(() => {
    if (!selectedElement) return
    const el = selectedElement
    const cy = el.y + el.height / 2
    const newEl: Element = {
      ...el,
      y: cy - el.height / 2,
      height: -el.height,
    }
    if (newEl.points) {
      newEl.points = newEl.points.map((p) => ({
        x: p.x,
        y: cy + (cy - p.y),
      }))
    }
    upsertElement(newEl)
    closeCtxMenu()
  }, [selectedElement, upsertElement, closeCtxMenu])

  const handleCopyPNG = useCallback(async () => {
    if (selectedIds.length === 0) return
    await copyToClipboardAsPNG(elements, selectedIds)
    closeCtxMenu()
  }, [elements, selectedIds, closeCtxMenu])

  // ── Export ─────────────────────────────────────────────────
  const handleExportAll = useCallback(() => {
    downloadAsPNG(elements, [], `calidraw-export-${Date.now()}.png`)
  }, [elements])

  const handleExportSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    downloadAsPNG(
      elements,
      selectedIds,
      `calidraw-selection-${Date.now()}.png`,
    )
  }, [elements, selectedIds])

  const hasSelection = selectedIds.length > 0

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <canvas
        ref={canvasRef}
        className="touch-none"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
      />

      {/* Export button above left toolbar */}
      <div className="pointer-events-auto absolute left-4 top-4 flex gap-1">
        <button
          type="button"
          title="Export All as PNG"
          onClick={handleExportAll}
          className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:text-zinc-700 active:scale-95 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          <IconDownload {...p} />
        </button>
        <button
          type="button"
          title="Export Selection as PNG"
          onClick={handleExportSelected}
          disabled={!hasSelection}
          className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:text-zinc-700 active:scale-95 disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-200"
        >
          <IconPhoto {...p} />
        </button>
      </div>

      <Toolbar elements={elements} onElementUpdate={upsertElement} />
      <ZoomControl />

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu}>
          {/* Flip */}
          <MenuItem onClick={flipHorizontal} disabled={!selectedElement}>
            <FlipHIcon /> Flip Horizontal
          </MenuItem>
          <MenuItem onClick={flipVertical} disabled={!selectedElement}>
            <FlipVIcon /> Flip Vertical
          </MenuItem>
          <MenuSeparator />

          {/* Ordering */}
          <MenuItem onClick={() => { if (selectedElement) { bringToFront(selectedElement.id); closeCtxMenu() } }} disabled={!selectedElement}>
            <BringFrontIcon /> Bring to Front
          </MenuItem>
          <MenuItem onClick={() => { if (selectedElement) { bringForward(selectedElement.id); closeCtxMenu() } }} disabled={!selectedElement}>
            <BringForwardIcon /> Bring Forward
          </MenuItem>
          <MenuItem onClick={() => { if (selectedElement) { sendBackward(selectedElement.id); closeCtxMenu() } }} disabled={!selectedElement}>
            <SendBackwardIcon /> Send Backward
          </MenuItem>
          <MenuItem onClick={() => { if (selectedElement) { sendToBack(selectedElement.id); closeCtxMenu() } }} disabled={!selectedElement}>
            <SendBackIcon /> Send to Back
          </MenuItem>
          <MenuSeparator />

          {/* Copy/Cut/Paste/Delete */}
          <MenuItem onClick={handleCopy} disabled={!hasSelection}>
            <CopyIcon /> Copy
          </MenuItem>
          <MenuItem onClick={handleCut} disabled={!hasSelection}>
            <CutIcon /> Cut
          </MenuItem>
          <MenuItem onClick={handlePaste} disabled={clipboardElements.length === 0}>
            <PasteIcon /> Paste
          </MenuItem>
          <MenuItem onClick={handleDelete} disabled={!hasSelection}>
            <DeleteIcon /> Delete
          </MenuItem>
          <MenuSeparator />

          {/* Copy as PNG */}
          <MenuItem onClick={handleCopyPNG} disabled={!hasSelection}>
            <PNGIcon /> Copy to Clipboard as PNG
          </MenuItem>
        </ContextMenu>
      )}
    </div>
  )
}

// ── Simple SVG icons for the context menu ──────────────────
function FlipHIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" /><path d="M7 16l-4-4 4-4" /><path d="M17 16l4-4-4-4" /><path d="M12 3v18" />
    </svg>
  )
}
function FlipVIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M16 7l4 4-4 4" /><path d="M8 7l-4 4 4 4" /><path d="M3 12h18" />
    </svg>
  )
}
function BringFrontIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="14" height="14" rx="2" /><rect x="2" y="8" width="14" height="14" rx="2" />
    </svg>
  )
}
function BringForwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="14" height="14" rx="2" /><path d="M2 18v-4h4v4H2z" opacity="0.4" />
    </svg>
  )
}
function SendBackwardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="14" height="14" rx="2" /><path d="M22 6v4h-4V6h4z" opacity="0.4" />
    </svg>
  )
}
function SendBackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="14" height="14" rx="2" opacity="0.4" /><rect x="8" y="2" width="14" height="14" rx="2" opacity="0.6" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}
function CutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  )
}
function PasteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
function PNGIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
