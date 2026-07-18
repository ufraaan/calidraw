import { useState, useCallback, useEffect, useRef } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setSelectedIds, triggerSaveStatus, DEFAULT_LIGHT, DEFAULT_DARK, startColorSchemeListener, subscribeColorScheme } from '../stores/canvas-store'
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
import { ExportModal } from './export-modal'
import { TextEditor } from './text-editor'
import { Minimap } from './minimap'
import { copyToClipboardAsPNG } from '../lib/renderer'
import { generateId, getNormalizedBounds } from '../lib/geometry'
import { IconDownload } from '@tabler/icons-react'
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
    replaceElements,
  } = useElements()

  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  useKeyboard()

  // ── Undo / Redo ─────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<Element[][]>([])
  const [redoStack, setRedoStack] = useState<Element[][]>([])
  const elementsRef = useRef(elements)
  elementsRef.current = elements

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => {
      const maxLen = 50
      const next = [...prev, elementsRef.current]
      return next.length > maxLen ? next.slice(next.length - maxLen) : next
    })
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setRedoStack((r) => [...r, elementsRef.current])
    setUndoStack((u) => u.slice(0, -1))
    replaceElements(prev)
    // Re-select whatever was selected
    const newIds = prev.filter((e) => selectedIds.includes(e.id)).map((e) => e.id)
    setSelectedIds(newIds)
  }, [undoStack, replaceElements, selectedIds])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setUndoStack((u) => [...u, elementsRef.current])
    setRedoStack((r) => r.slice(0, -1))
    replaceElements(next)
    const newIds = next.filter((e) => selectedIds.includes(e.id)).map((e) => e.id)
    setSelectedIds(newIds)
  }, [redoStack, replaceElements, selectedIds])

  // ── Context menu state ────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{
    x: number
    y: number
  } | null>(null)

  // ── Export modal state ─────────────────────────────────────
  const [showExport, setShowExport] = useState(false)

  // ── Text editing state ─────────────────────────────────────
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const editingTextEl = editingTextId ? elements.find((e) => e.id === editingTextId) ?? null : null

  const handleTextSave = useCallback(
    (id: string, text: string) => {
      const el = elements.find((e) => e.id === id)
      if (el) {
        pushUndo()
        upsertElement({ ...el, text })
      }
      setEditingTextId(null)
    },
    [elements, upsertElement, pushUndo],
  )

  const handleTextCancel = useCallback(() => {
    setEditingTextId(null)
  }, [])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // ── Canvas handlers ───────────────────────────────────────
  const { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useCanvas({
      elements,
      onElementCreate: (el) => {
        pushUndo()
        upsertElement(el)
        // Auto-enter text editing when a text element is created
        if (el.type === 'text') {
          setEditingTextId(el.id)
        }
      },
      onElementsUpdate: (els) => {
        pushUndo()
        upsertElements(els)
      },
    })

  // ── Color-scheme listener (adapts defaults + migrates elements) ─
  const replaceElementsRef = useRef(replaceElements)
  replaceElementsRef.current = replaceElements

  useEffect(() => {
    const unsub = subscribeColorScheme((isDark) => {
      const from = isDark ? DEFAULT_LIGHT : DEFAULT_DARK
      const to = isDark ? DEFAULT_DARK : DEFAULT_LIGHT
      const updated = elementsRef.current.map((el) =>
        el.strokeColor === from ? { ...el, strokeColor: to } : el,
      )
      if (updated.some((el, i) => el.strokeColor !== elementsRef.current[i].strokeColor)) {
        replaceElementsRef.current(updated)
      }
    })
    const cleanup = startColorSchemeListener()
    return () => {
      unsub()
      cleanup()
    }
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      closeCtxMenu()
      // Click outside text editor — commit
      if (editingTextId) {
        setEditingTextId(null)
      }
      handlePointerDown(e)
    },
    [handlePointerDown, closeCtxMenu, editingTextId],
  )

  // ── Double-click → text editing ────────────────────────────
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const s = canvasStore.state
      const cx = (e.clientX - s.offsetX) / s.zoom
      const cy = (e.clientY - s.offsetY) / s.zoom

      // Find a text element under the cursor
      const hit = [...elements].reverse().find((el) => {
        if (el.type !== 'text') return false
        const b = getNormalizedBounds(el)
        return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h
      })

      if (hit) {
        setEditingTextId(hit.id)
        setSelectedIds([hit.id])
      }
    },
    [elements],
  )

  // ── Right-click → context menu ────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      e.stopPropagation()

      const s = canvasStore.state
      const cx = (e.clientX - s.offsetX) / s.zoom
      const cy = (e.clientY - s.offsetY) / s.zoom

      const hit = [...elements].reverse().find((el) => {
        const b = getNormalizedBounds(el)
        return cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h
      })

      if (hit) {
        if (!selectedIds.includes(hit.id)) {
          setSelectedIds([hit.id])
        }
      } else {
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
    pushUndo()
    deleteElements(selectedIds)
    setSelectedIds([])
    closeCtxMenu()
  }, [elements, selectedIds, deleteElements, closeCtxMenu, pushUndo])

  const handlePaste = useCallback(() => {
    if (clipboardElements.length === 0) return
    const s = canvasStore.state
    const cx = (window.innerWidth / 2 - s.offsetX) / s.zoom
    const cy = (window.innerHeight / 2 - s.offsetY) / s.zoom

    const pasted = clipboardElements.map((el, i) => ({
      ...el,
      id: generateId(),
      x: el.x + cx - 50 + i * 20,
      y: el.y + cy - 50 + i * 20,
    }))
    pushUndo()
    upsertElements(pasted)
    setSelectedIds(pasted.map((e) => e.id))
    closeCtxMenu()
  }, [closeCtxMenu, upsertElements, pushUndo])

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return
    pushUndo()
    deleteElements(selectedIds)
    setSelectedIds([])
    closeCtxMenu()
  }, [selectedIds, deleteElements, closeCtxMenu, pushUndo])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    pushUndo()
    deleteElements(selectedIds)
    setSelectedIds([])
  }, [selectedIds, deleteElements, pushUndo])

  const handleCopyPNG = useCallback(async () => {
    if (selectedIds.length === 0) return
    await copyToClipboardAsPNG(elements, selectedIds)
    closeCtxMenu()
  }, [elements, selectedIds, closeCtxMenu])

  // ── Copy / Paste Style state ─────────────────────────────
  const [copiedStyle, setCopiedStyle] = useState<Partial<Element> | null>(null)

  // ── Select all, duplicate, nudge ─────────────────────────
  const handleSelectAll = useCallback(() => {
    setSelectedIds(elements.map((e) => e.id))
  }, [elements])

  const handleDuplicate = useCallback(() => {
    if (selectedIds.length === 0) return
    pushUndo()
    const dups = elements
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => ({
        ...e,
        id: generateId(),
        x: e.x + 20,
        y: e.y + 20,
      }))
    upsertElements(dups)
    setSelectedIds(dups.map((e) => e.id))
  }, [elements, selectedIds, upsertElements, pushUndo])

  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return
      pushUndo()
      const nudged = elements
        .filter((e) => selectedIds.includes(e.id))
        .map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }))
      upsertElements(nudged)
    },
    [elements, selectedIds, upsertElements, pushUndo],
  )

  useEffect(() => {
    setClipboardActions({
      copy: handleCopy,
      cut: handleCut,
      paste: handlePaste,
      deleteSelected: handleDeleteSelected,
      selectAll: handleSelectAll,
      duplicate: handleDuplicate,
      nudge: handleNudge,
      undo: handleUndo,
      redo: handleRedo,
    })
  }, [
    handleCopy,
    handleCut,
    handlePaste,
    handleDeleteSelected,
    handleSelectAll,
    handleDuplicate,
    handleNudge,
    handleUndo,
    handleRedo,
  ])

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
              const scale = Math.min(400 / img.width, 400 / img.height, 1)
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
              pushUndo()
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
  }, [canvasRef, upsertElement, pushUndo])

  // ── Save status tracking ──────────────────────────────────
  useEffect(() => {
    if (elements.length > 0) triggerSaveStatus()
  }, [elements])

  // ── Context menu actions ──────────────────────────────────
  const selectedElement =
    selectedIds.length === 1
      ? elements.find((e) => e.id === selectedIds[0]) ?? null
      : null

  const multiSelectedElements =
    selectedIds.length > 1
      ? elements.filter((e) => selectedIds.includes(e.id))
      : null

  const flipHorizontal = useCallback(() => {
    if (!selectedElement) return
    pushUndo()
    const el = selectedElement
    const cx = el.x + el.width / 2
    const newEl: Element = {
      ...el,
      x: cx - el.width / 2,
      width: -el.width,
    }
    if (newEl.points) {
      newEl.points = newEl.points.map((p) => ({
        x: cx + (cx - p.x),
        y: p.y,
      }))
    }
    upsertElement(newEl)
    closeCtxMenu()
  }, [selectedElement, upsertElement, closeCtxMenu, pushUndo])

  const flipVertical = useCallback(() => {
    if (!selectedElement) return
    pushUndo()
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
  }, [selectedElement, upsertElement, closeCtxMenu, pushUndo])

  const hasSelection = selectedIds.length > 0
  const hasMultiSel = selectedIds.length > 1
  const hasThreePlus = selectedIds.length > 2

  // ── Copy / Paste Style ───────────────────────────────────
  const handleCopyStyle = useCallback(() => {
    if (!selectedElement) return
    setCopiedStyle({
      strokeColor: selectedElement.strokeColor,
      backgroundColor: selectedElement.backgroundColor,
      strokeWidth: selectedElement.strokeWidth,
      strokeStyle: selectedElement.strokeStyle,
      opacity: selectedElement.opacity,
      roughness: selectedElement.roughness,
    })
    closeCtxMenu()
  }, [selectedElement, closeCtxMenu])

  const handlePasteStyle = useCallback(() => {
    if (!copiedStyle || !hasSelection) return
    pushUndo()
    const updated = elements
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => ({ ...e, ...copiedStyle }))
    upsertElements(updated)
    closeCtxMenu()
  }, [copiedStyle, hasSelection, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  // ── Alignment handlers ─────────────────────────────────────
  const alignLeft = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const minX = Math.min(...multiSelectedElements.map((e) => getNormalizedBounds(e).x))
    const updated = elements.map((e) =>
      selectedIds.includes(e.id) ? { ...e, x: minX } : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  const alignRight = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const maxRight = Math.max(...multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.x + b.w
    }))
    const updated = elements.map((e) =>
      selectedIds.includes(e.id)
        ? { ...e, x: maxRight - Math.abs(e.width) }
        : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  const alignCenterX = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const centers = multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.x + b.w / 2
    })
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    const updated = elements.map((e) =>
      selectedIds.includes(e.id)
        ? { ...e, x: avgCenter - Math.abs(e.width) / 2 }
        : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  const alignTop = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const minY = Math.min(...multiSelectedElements.map((e) => getNormalizedBounds(e).y))
    const updated = elements.map((e) =>
      selectedIds.includes(e.id) ? { ...e, y: minY } : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  const alignBottom = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const maxBottom = Math.max(...multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.y + b.h
    }))
    const updated = elements.map((e) =>
      selectedIds.includes(e.id)
        ? { ...e, y: maxBottom - Math.abs(e.height) }
        : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  const alignCenterY = useCallback(() => {
    if (!multiSelectedElements) return
    pushUndo()
    const centers = multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.y + b.h / 2
    })
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    const updated = elements.map((e) =>
      selectedIds.includes(e.id)
        ? { ...e, y: avgCenter - Math.abs(e.height) / 2 }
        : e,
    )
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, elements, selectedIds, upsertElements, closeCtxMenu, pushUndo])

  // ── Distribute handlers ────────────────────────────────────
  const distributeHorizontally = useCallback(() => {
    if (!multiSelectedElements || selectedIds.length < 3) return
    pushUndo()
    const sel = multiSelectedElements.sort((a, b) => {
      const ba = getNormalizedBounds(a)
      const bb = getNormalizedBounds(b)
      return ba.x + ba.w / 2 - (bb.x + bb.w / 2)
    })
    const first = getNormalizedBounds(sel[0])
    const last = getNormalizedBounds(sel[sel.length - 1])
    const start = first.x + first.w / 2
    const end = last.x + last.w / 2
    const totalWidth = end - start
    const gap = totalWidth / (sel.length - 1)

    const updated = elements.map((e) => {
      const idx = sel.findIndex((s) => s.id === e.id)
      if (idx === -1) return e
      const targetCenter = start + gap * idx
      return { ...e, x: targetCenter - Math.abs(e.width) / 2 }
    })
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, selectedIds, elements, upsertElements, closeCtxMenu, pushUndo])

  const distributeVertically = useCallback(() => {
    if (!multiSelectedElements || selectedIds.length < 3) return
    pushUndo()
    const sel = multiSelectedElements.sort((a, b) => {
      const ba = getNormalizedBounds(a)
      const bb = getNormalizedBounds(b)
      return ba.y + ba.h / 2 - (bb.y + bb.h / 2)
    })
    const first = getNormalizedBounds(sel[0])
    const last = getNormalizedBounds(sel[sel.length - 1])
    const start = first.y + first.h / 2
    const end = last.y + last.h / 2
    const totalHeight = end - start
    const gap = totalHeight / (sel.length - 1)

    const updated = elements.map((e) => {
      const idx = sel.findIndex((s) => s.id === e.id)
      if (idx === -1) return e
      const targetCenter = start + gap * idx
      return { ...e, y: targetCenter - Math.abs(e.height) / 2 }
    })
    upsertElements(updated)
    closeCtxMenu()
  }, [multiSelectedElements, selectedIds, elements, upsertElements, closeCtxMenu, pushUndo])

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
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* Text editing overlay */}
      {editingTextEl && (
        <TextEditor
          element={editingTextEl}
          onSave={handleTextSave}
          onCancel={handleTextCancel}
        />
      )}

      {/* Export button — top left */}
      <div className="pointer-events-auto absolute left-4 top-4">
        <button
          type="button"
          onClick={() => setShowExport(true)}
          title="Export"
          className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] active:scale-95 dark:text-zinc-500 dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
        >
          <IconDownload {...p} />
        </button>
      </div>

      <Minimap elements={elements} />
      <Toolbar elements={elements} onElementUpdate={upsertElement} />
      <ZoomControl />

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          elements={elements}
          selectedIds={selectedIds}
          onClose={() => setShowExport(false)}
        />
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu}>
          <MenuItem onClick={flipHorizontal} disabled={!selectedElement}>
            <FlipHIcon /> Flip Horizontal
          </MenuItem>
          <MenuItem onClick={flipVertical} disabled={!selectedElement}>
            <FlipVIcon /> Flip Vertical
          </MenuItem>
          <MenuSeparator />

          <MenuItem
            onClick={() => {
              if (selectedElement) {
                pushUndo()
                bringToFront(selectedElement.id)
                closeCtxMenu()
              }
            }}
            disabled={!selectedElement}
          >
            <BringFrontIcon /> Bring to Front
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                pushUndo()
                bringForward(selectedElement.id)
                closeCtxMenu()
              }
            }}
            disabled={!selectedElement}
          >
            <BringForwardIcon /> Bring Forward
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                pushUndo()
                sendBackward(selectedElement.id)
                closeCtxMenu()
              }
            }}
            disabled={!selectedElement}
          >
            <SendBackwardIcon /> Send Backward
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                pushUndo()
                sendToBack(selectedElement.id)
                closeCtxMenu()
              }
            }}
            disabled={!selectedElement}
          >
            <SendBackIcon /> Send to Back
          </MenuItem>
          <MenuSeparator />

          {/* Alignment */}
          <MenuItem onClick={alignLeft} disabled={!hasMultiSel}>
            <AlignLeftIcon /> Align Left
          </MenuItem>
          <MenuItem onClick={alignCenterX} disabled={!hasMultiSel}>
            <AlignCenterXIcon /> Align Center
          </MenuItem>
          <MenuItem onClick={alignRight} disabled={!hasMultiSel}>
            <AlignRightIcon /> Align Right
          </MenuItem>
          <MenuItem onClick={alignTop} disabled={!hasMultiSel}>
            <AlignTopIcon /> Align Top
          </MenuItem>
          <MenuItem onClick={alignCenterY} disabled={!hasMultiSel}>
            <AlignCenterYIcon /> Align Middle
          </MenuItem>
          <MenuItem onClick={alignBottom} disabled={!hasMultiSel}>
            <AlignBottomIcon /> Align Bottom
          </MenuItem>
          <MenuSeparator />

          {/* Distribute */}
          <MenuItem onClick={distributeHorizontally} disabled={!hasThreePlus}>
            <DistributeHIcon /> Distribute Horizontally
          </MenuItem>
          <MenuItem onClick={distributeVertically} disabled={!hasThreePlus}>
            <DistributeVIcon /> Distribute Vertically
          </MenuItem>
          <MenuSeparator />

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

          <MenuItem onClick={handleCopyStyle} disabled={!selectedElement}>
            <StyleIcon /> Copy Style
          </MenuItem>
          <MenuItem onClick={handlePasteStyle} disabled={!copiedStyle || !hasSelection}>
            <PasteStyleIcon /> Paste Style
          </MenuItem>
          <MenuSeparator />

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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" /><path d="M7 16l-4-4 4-4" /><path d="M17 16l4-4-4-4" /><path d="M12 3v18" />
    </svg>
  )
}
function FlipVIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18" /><path d="M16 7l4 4-4 4" /><path d="M8 7l-4 4 4 4" /><path d="M3 12h18" />
    </svg>
  )
}
function BringFrontIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="14" height="14" rx="2" /><rect x="2" y="8" width="14" height="14" rx="2" opacity="0.3" />
    </svg>
  )
}
function BringForwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="14" height="14" rx="2" /><path d="M2 18v-4h4v4H2z" opacity="0.3" />
    </svg>
  )
}
function SendBackwardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="14" height="14" rx="2" /><path d="M22 6v4h-4V6h4z" opacity="0.3" />
    </svg>
  )
}
function SendBackIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="8" width="14" height="14" rx="2" opacity="0.3" /><rect x="8" y="2" width="14" height="14" rx="2" opacity="0.5" />
    </svg>
  )
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}
function CutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" />
    </svg>
  )
}
function PasteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  )
}
function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  )
}
function PNGIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
function StyleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}
function PasteStyleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3h4a2 2 0 012 2v2" /><path d="M16 17h4a2 2 0 002-2V7l-4-4h-4" /><rect x="2" y="11" width="10" height="10" rx="1" />
    </svg>
  )
}

// ── Alignment icons ────────────────────────────────────────
function AlignLeftIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="17" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="3" y2="18" />
    </svg>
  )
}
function AlignCenterXIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="18" y1="14" x2="6" y2="14" /><line x1="21" y1="18" x2="3" y2="18" />
    </svg>
  )
}
function AlignRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="7" y2="14" /><line x1="21" y1="18" x2="3" y2="18" />
    </svg>
  )
}
function AlignTopIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="7" x2="14" y2="21" /><line x1="10" y1="3" x2="10" y2="21" /><line x1="6" y1="7" x2="6" y2="21" /><line x1="18" y1="3" x2="18" y2="21" />
    </svg>
  )
}
function AlignCenterYIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="18" x2="14" y2="6" /><line x1="10" y1="21" x2="10" y2="3" /><line x1="6" y1="18" x2="6" y2="6" /><line x1="18" y1="21" x2="18" y2="3" />
    </svg>
  )
}
function AlignBottomIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="14" y1="17" x2="14" y2="3" /><line x1="10" y1="21" x2="10" y2="3" /><line x1="6" y1="17" x2="6" y2="3" /><line x1="18" y1="21" x2="18" y2="3" />
    </svg>
  )
}
function DistributeHIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="7" cy="6" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="17" cy="18" r="1" fill="currentColor" />
    </svg>
  )
}
function DistributeVIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="21" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="18" y1="3" x2="18" y2="21" />
      <circle cx="6" cy="7" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="18" cy="17" r="1" fill="currentColor" />
    </svg>
  )
}
