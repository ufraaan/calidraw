import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react'
import { useSelector } from '@tanstack/react-store'
import { canvasStore, setSelectedIds, triggerSaveStatus, DEFAULT_LIGHT, DEFAULT_DARK, startColorSchemeListener, subscribeColorScheme, setTheme } from '../stores/canvas-store'
import { useElements } from '../hooks/use-elements'
import {
  useKeyboard,
  setClipboardActions,
  clipboardElements,
  copyToClipboard as copyToInternalClipboard,
} from '../hooks/use-keyboard'
import { useCanvas } from '../hooks/use-canvas'
import { saveElements as persistElements } from '../db/elements'
import { Toolbar } from './toolbar'
import { ZoomControl, zoomToFit } from './zoom-control'
import { ContextMenu, MenuItem, MenuSeparator } from './context-menu'
import { TextEditor } from './text-editor'
import { Minimap } from './minimap'
import { IconExport, IconImage } from './ui/icons'
import { copyToClipboardAsPNG, sceneFromJSON } from '../lib/renderer'
import { generateId, getNormalizedBounds } from '../lib/geometry'
import type { ReactNode } from 'react'
import type { Element } from '../types'

const ExportModal = lazy(() => import('./export-modal').then((m) => ({ default: m.ExportModal })))

function fileToImageElement(file: File): Promise<Element | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (!dataUrl) {
        resolve(null)
        return
      }
      const img = new Image()
      img.onload = () => {
        const s = canvasStore.state
        const vpCx = (window.innerWidth / 2 - s.offsetX) / s.zoom
        const vpCy = (window.innerHeight / 2 - s.offsetY) / s.zoom
        const scale = Math.min(400 / img.width, 400 / img.height, 1)
        const w = Math.max(1, img.width * scale)
        const h = Math.max(1, img.height * scale)
        resolve({
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
          bowing: 0,
          opacity: 100,
          imageData: dataUrl,
        })
      }
      img.onerror = () => resolve(null)
      img.src = dataUrl
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export function CanvasView(): ReactNode {
  const {
    elements,
    upsertElements,
    deleteElements,
    setElements,
    replaceElements,
  } = useElements()

  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  useKeyboard()

  // ── Undo / Redo (delta-based: each op records only affected ids) ──
  interface HistoryOp {
    label: string
    undo: () => void
    redo: () => void
  }
  const [undoStack, setUndoStack] = useState<HistoryOp[]>([])
  const [redoStack, setRedoStack] = useState<HistoryOp[]>([])
  const elementsRef = useRef(elements)
  elementsRef.current = elements
  const undoStackRef = useRef(undoStack)
  undoStackRef.current = undoStack
  const redoStackRef = useRef(redoStack)
  redoStackRef.current = redoStack

  const pushOp = useCallback((op: HistoryOp) => {
    setUndoStack((prev) => [...prev.slice(-29), op])
    setRedoStack([])
  }, [])

  const handleUndo = useCallback(() => {
    const op = undoStackRef.current[undoStackRef.current.length - 1]
    if (!op) return
    op.undo()
    setUndoStack((u) => u.slice(0, -1))
    setRedoStack((r) => [...r, op])
  }, [])

  const handleRedo = useCallback(() => {
    const op = redoStackRef.current[redoStackRef.current.length - 1]
    if (!op) return
    op.redo()
    setRedoStack((r) => r.slice(0, -1))
    setUndoStack((u) => [...u.slice(-29), op])
  }, [])

  // ── Tracked mutations (record delta inverses, apply without re-recording) ──
  const trackedUpserts = useCallback((afters: Element[], label: string) => {
    if (afters.length === 0) return
    const beforeMap = new Map<string, Element | undefined>()
    for (const a of afters) {
      beforeMap.set(a.id, elementsRef.current.find((e) => e.id === a.id))
    }
    const afterIds = afters.map((a) => a.id)
    pushOp({
      label,
      undo: () => {
        const restores: Element[] = []
        const added: string[] = []
        for (const [id, prev] of beforeMap) {
          if (prev) restores.push(prev)
          else added.push(id)
        }
        if (restores.length > 0) void upsertElements(restores)
        if (added.length > 0) void deleteElements(added)
        setSelectedIds(afterIds.filter((id) => beforeMap.get(id) !== undefined))
      },
      redo: () => {
        void upsertElements(afters)
        setSelectedIds(afterIds)
      },
    })
    void upsertElements(afters)
    setSelectedIds(afterIds)
  }, [pushOp, upsertElements, deleteElements])

  const trackedDeletes = useCallback((ids: string[], label: string) => {
    if (ids.length === 0) return
    const before = elementsRef.current.filter((e) => ids.includes(e.id))
    pushOp({
      label,
      undo: () => {
        void upsertElements(before)
        setSelectedIds(before.map((e) => e.id))
      },
      redo: () => {
        void deleteElements(ids)
        setSelectedIds([])
      },
    })
    void deleteElements(ids)
    setSelectedIds([])
  }, [pushOp, upsertElements, deleteElements])

  const trackedReorder = useCallback((compute: (prev: Element[]) => Element[] | null, label: string) => {
    const before = elementsRef.current
    const after = compute(before)
    if (!after || after === before) return
    pushOp({
      label,
      undo: () => {
        setElements(before)
        persistElements(before).catch(() => {})
      },
      redo: () => {
        setElements(after)
        persistElements(after).catch(() => {})
      },
    })
    setElements(after)
    persistElements(after).catch(() => {})
  }, [pushOp, setElements])

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
  const isNewTextEl = editingTextEl ? !editingTextEl.text : false
  // Latest TextEditor commit — lets click-away save explicitly
  // instead of relying on the blur-after-unmount race.
  const textCommitRef = useRef<(() => void) | null>(null)

  const handleTextSave = useCallback(
    (id: string, text: string, width: number, height: number) => {
      const el = elements.find((e) => e.id === id)
      if (el) {
        trackedUpserts([{ ...el, text, width, height }], 'edit text')
      }
      setEditingTextId(null)
    },
    [elements, trackedUpserts],
  )

  const handleTextCancel = useCallback(() => {
    // Cancelling a brand-new (still empty) placeholder removes it
    // silently (no undo entry) so no invisible boxes pile up.
    if (editingTextId && isNewTextEl) {
      void deleteElements([editingTextId])
    }
    setEditingTextId(null)
  }, [editingTextId, isNewTextEl, deleteElements])

  const closeCtxMenu = useCallback(() => setCtxMenu(null), [])

  // ── Canvas handlers ───────────────────────────────────────
  const { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useCanvas({
      elements,
      editingTextId,
      onElementCreate: (el) => {
        trackedUpserts([el], 'create element')
        // Auto-enter text editing when a text element is created
        if (el.type === 'text') {
          setEditingTextId(el.id)
        }
      },
      onElementsUpdate: (els) => {
        trackedUpserts(els, 'update elements')
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
      // Click outside the text editor — commit first so the text
      // is saved, then proceed with the pointer handling.
      if (editingTextId) {
        textCommitRef.current?.()
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

      // Find a text element under the cursor (topmost first)
      let hit: Element | undefined
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i]
        if (el.type !== 'text') continue
        const b = getNormalizedBounds(el)
        if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
          hit = el
          break
        }
      }

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

      const hit = (() => {
        for (let i = elements.length - 1; i >= 0; i--) {
          const el = elements[i]
          const b = getNormalizedBounds(el)
          if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return el
        }
        return undefined
      })()

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
    trackedDeletes(selectedIds, 'cut')
    closeCtxMenu()
  }, [elements, selectedIds, trackedDeletes, closeCtxMenu])

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
    trackedUpserts(pasted, 'paste')
    closeCtxMenu()
  }, [closeCtxMenu, trackedUpserts])

  const handleDelete = useCallback(() => {
    if (selectedIds.length === 0) return
    trackedDeletes(selectedIds, 'delete')
    closeCtxMenu()
  }, [selectedIds, trackedDeletes, closeCtxMenu])

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return
    trackedDeletes(selectedIds, 'delete')
  }, [selectedIds, trackedDeletes])

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
    const dups = elements
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => ({
        ...e,
        id: generateId(),
        x: e.x + 20,
        y: e.y + 20,
      }))
    trackedUpserts(dups, 'duplicate')
  }, [elements, selectedIds, trackedUpserts])

  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.length === 0) return
      const nudged = elements
        .filter((e) => selectedIds.includes(e.id))
        .map((e) => ({ ...e, x: e.x + dx, y: e.y + dy }))
      trackedUpserts(nudged, 'nudge')
    },
    [elements, selectedIds, trackedUpserts],
  )

  const handleZoomFit = useCallback(() => {
    zoomToFit(elementsRef.current)
  }, [])

  const handleZoomSelection = useCallback(() => {
    const s = canvasStore.state
    const sel = elementsRef.current.filter((e) => s.selectedIds.includes(e.id))
    if (sel.length > 0) zoomToFit(sel)
  }, [])

  const handleOpenExport = useCallback(() => {
    setShowExport(true)
    closeCtxMenu()
  }, [closeCtxMenu])

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
      zoomFit: handleZoomFit,
      zoomSelection: handleZoomSelection,
      exportCanvas: handleOpenExport,
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
    handleZoomFit,
    handleZoomSelection,
    handleOpenExport,
  ])

  // ── Image insert helper ───────────────────────────────────
  const insertImageFile = useCallback(async (file: File) => {
    const el = await fileToImageElement(file)
    if (!el) return
    trackedUpserts([el], 'insert image')
  }, [trackedUpserts])

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Clipboard paste (images) on window + JSON scene ───────
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const items = e.clipboardData?.items
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          if (item.type.startsWith('image/')) {
            e.preventDefault()
            const file = item.getAsFile()
            if (file) void insertImageFile(file)
            return
          }
        }
      }
      const text = e.clipboardData?.getData('text/plain')
      if (text && text.includes('calidraw-scene')) {
        const els = sceneFromJSON(text)
        if (els && els.length > 0) {
          e.preventDefault()
          const fresh = els.map((el) => ({ ...el, id: generateId() }))
          trackedUpserts(fresh, 'import scene')
        }
      }
    }

    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [insertImageFile, trackedUpserts])

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
    if (selectedIds.length === 0) return
    if (selectedElement) {
      const el = selectedElement
      const cx = el.x + el.width / 2
      const newEl: Element = {
        ...el,
        x: cx - el.width / 2,
        width: -el.width,
      }
      if (newEl.points) {
        newEl.points = newEl.points.map((pt) => ({
          x: cx + (cx - pt.x),
          y: pt.y,
        }))
      }
      trackedUpserts([newEl], 'flip horizontal')
    } else {
      // Multi-select: mirror around collective center.
      const sel = elements.filter((e) => selectedIds.includes(e.id))
      let minX = Infinity, maxX = -Infinity
      for (const e of sel) {
        const b = getNormalizedBounds(e)
        if (b.x < minX) minX = b.x
        if (b.x + b.w > maxX) maxX = b.x + b.w
      }
      const cx = (minX + maxX) / 2
      trackedUpserts(sel.map((el) => {
        const b = getNormalizedBounds(el)
        const nx = cx + (cx - (b.x + b.w)) // mirrored left edge
        const base = { ...el, x: nx, width: Math.abs(el.width) as number }
        if (base.points) {
          base.points = base.points.map((pt) => ({ x: cx + (cx - pt.x), y: pt.y }))
        }
        return base
      }), 'flip horizontal')
    }
    closeCtxMenu()
  }, [selectedElement, elements, selectedIds, trackedUpserts, closeCtxMenu])

  const flipVertical = useCallback(() => {
    if (selectedIds.length === 0) return
    if (selectedElement) {
      const el = selectedElement
      const cy = el.y + el.height / 2
      const newEl: Element = {
        ...el,
        y: cy - el.height / 2,
        height: -el.height,
      }
      if (newEl.points) {
        newEl.points = newEl.points.map((pt) => ({
          x: pt.x,
          y: cy + (cy - pt.y),
        }))
      }
      trackedUpserts([newEl], 'flip vertical')
    } else {
      const sel = elements.filter((e) => selectedIds.includes(e.id))
      let minY = Infinity, maxY = -Infinity
      for (const e of sel) {
        const b = getNormalizedBounds(e)
        if (b.y < minY) minY = b.y
        if (b.y + b.h > maxY) maxY = b.y + b.h
      }
      const cy = (minY + maxY) / 2
      trackedUpserts(sel.map((el) => {
        const b = getNormalizedBounds(el)
        const ny = cy + (cy - (b.y + b.h))
        const base = { ...el, y: ny, height: Math.abs(el.height) as number }
        if (base.points) {
          base.points = base.points.map((pt) => ({ x: pt.x, y: cy + (cy - pt.y) }))
        }
        return base
      }), 'flip vertical')
    }
    closeCtxMenu()
  }, [selectedElement, elements, selectedIds, trackedUpserts, closeCtxMenu])

  // Multi-select z-order: move all selected preserving relative order.
  const bringSelectedToFront = useCallback(() => {
    if (selectedIds.length < 2) return
    const selSet = new Set(selectedIds)
    trackedReorder((prev) => {
      if (!prev.some((e) => selSet.has(e.id))) return null
      return [...prev.filter((e) => !selSet.has(e.id)), ...prev.filter((e) => selSet.has(e.id))]
    }, 'bring to front')
    closeCtxMenu()
  }, [selectedIds, trackedReorder, closeCtxMenu])

  const sendSelectedToBack = useCallback(() => {
    if (selectedIds.length < 2) return
    const selSet = new Set(selectedIds)
    trackedReorder((prev) => {
      if (!prev.some((e) => selSet.has(e.id))) return null
      return [...prev.filter((e) => selSet.has(e.id)), ...prev.filter((e) => !selSet.has(e.id))]
    }, 'send to back')
    closeCtxMenu()
  }, [selectedIds, trackedReorder, closeCtxMenu])

  // Single-element z-order via the same reorder path (undoable).
  const bringToFrontTracked = useCallback((id: string) => {
    trackedReorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.push(el)
      return next
    }, 'bring to front')
    closeCtxMenu()
  }, [trackedReorder, closeCtxMenu])

  const bringForwardTracked = useCallback((id: string) => {
    trackedReorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx + 1, 0, el)
      return next
    }, 'bring forward')
    closeCtxMenu()
  }, [trackedReorder, closeCtxMenu])

  const sendBackwardTracked = useCallback((id: string) => {
    trackedReorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx - 1, 0, el)
      return next
    }, 'send backward')
    closeCtxMenu()
  }, [trackedReorder, closeCtxMenu])

  const sendToBackTracked = useCallback((id: string) => {
    trackedReorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.unshift(el)
      return next
    }, 'send to back')
    closeCtxMenu()
  }, [trackedReorder, closeCtxMenu])

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
      bowing: selectedElement.bowing,
    })
    closeCtxMenu()
  }, [selectedElement, closeCtxMenu])

  const handlePasteStyle = useCallback(() => {
    if (!copiedStyle || !hasSelection) return
    const updated = elements
      .filter((e) => selectedIds.includes(e.id))
      .map((e) => ({ ...e, ...copiedStyle }))
    trackedUpserts(updated, 'paste style')
    closeCtxMenu()
  }, [copiedStyle, hasSelection, elements, selectedIds, trackedUpserts, closeCtxMenu])

  // ── Alignment handlers (dirty-only writes) ────────────────
  const alignLeft = useCallback(() => {
    if (!multiSelectedElements) return
    const minX = Math.min(...multiSelectedElements.map((e) => getNormalizedBounds(e).x))
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, x: minX })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  const alignRight = useCallback(() => {
    if (!multiSelectedElements) return
    const maxRight = Math.max(...multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.x + b.w
    }))
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, x: maxRight - Math.abs(e.width) })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  const alignCenterX = useCallback(() => {
    if (!multiSelectedElements) return
    const centers = multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.x + b.w / 2
    })
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, x: avgCenter - Math.abs(e.width) / 2 })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  const alignTop = useCallback(() => {
    if (!multiSelectedElements) return
    const minY = Math.min(...multiSelectedElements.map((e) => getNormalizedBounds(e).y))
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, y: minY })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  const alignBottom = useCallback(() => {
    if (!multiSelectedElements) return
    const maxBottom = Math.max(...multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.y + b.h
    }))
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, y: maxBottom - Math.abs(e.height) })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  const alignCenterY = useCallback(() => {
    if (!multiSelectedElements) return
    const centers = multiSelectedElements.map((e) => {
      const b = getNormalizedBounds(e)
      return b.y + b.h / 2
    })
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    trackedUpserts(multiSelectedElements.map((e) => ({ ...e, y: avgCenter - Math.abs(e.height) / 2 })), 'align')
    closeCtxMenu()
  }, [multiSelectedElements, trackedUpserts, closeCtxMenu])

  // ── Distribute handlers (dirty-only writes) ────────────────
  const distributeHorizontally = useCallback(() => {
    if (!multiSelectedElements || selectedIds.length < 3) return
    const sel = [...multiSelectedElements].sort((a, b) => {
      const ba = getNormalizedBounds(a)
      const bb = getNormalizedBounds(b)
      return ba.x + ba.w / 2 - (bb.x + bb.w / 2)
    })
    const first = getNormalizedBounds(sel[0])
    const last = getNormalizedBounds(sel[sel.length - 1])
    const start = first.x + first.w / 2
    const end = last.x + last.w / 2
    const gap = (end - start) / (sel.length - 1)

    trackedUpserts(sel.map((e, idx) => {
      const targetCenter = start + gap * idx
      return { ...e, x: targetCenter - Math.abs(e.width) / 2 }
    }), 'distribute')
    closeCtxMenu()
  }, [multiSelectedElements, selectedIds, trackedUpserts, closeCtxMenu])

  const distributeVertically = useCallback(() => {
    if (!multiSelectedElements || selectedIds.length < 3) return
    const sel = [...multiSelectedElements].sort((a, b) => {
      const ba = getNormalizedBounds(a)
      const bb = getNormalizedBounds(b)
      return ba.y + ba.h / 2 - (bb.y + bb.h / 2)
    })
    const first = getNormalizedBounds(sel[0])
    const last = getNormalizedBounds(sel[sel.length - 1])
    const start = first.y + first.h / 2
    const end = last.y + last.h / 2
    const gap = (end - start) / (sel.length - 1)

    trackedUpserts(sel.map((e, idx) => {
      const targetCenter = start + gap * idx
      return { ...e, y: targetCenter - Math.abs(e.height) / 2 }
    }), 'distribute')
    closeCtxMenu()
  }, [multiSelectedElements, selectedIds, trackedUpserts, closeCtxMenu])

  const isDark = useSelector(canvasStore, (s) => s.isDark)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    if (longPressRef.current) clearTimeout(longPressRef.current)
    longPressRef.current = setTimeout(() => {
      setCtxMenu({ x: t.clientX, y: t.clientY })
    }, 550)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }, [])

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
        files.forEach((f) => void insertImageFile(f))
        const json = e.dataTransfer?.getData('text/plain')
        if (json && json.includes('calidraw-scene')) {
          const els = sceneFromJSON(json)
          if (els && els.length > 0) {
            const fresh = els.map((el) => ({ ...el, id: generateId() }))
            trackedUpserts(fresh, 'import scene')
          }
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className="touch-none"
        tabIndex={0}
        role="application"
        aria-label="Drawing canvas. Press V for select, R for rectangle, T for text, question mark for all shortcuts."
        onPointerDown={onPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      />

      {/* Text editing overlay */}
      {editingTextEl && (
        <TextEditor
          element={editingTextEl}
          isNew={isNewTextEl}
          commitRef={textCommitRef}
          onSave={handleTextSave}
          onCancel={handleTextCancel}
        />
      )}

      {/* Top-left actions: export, image, theme */}
      <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setShowExport(true)}
          title="Export (Ctrl+E)"
          aria-label="Export canvas"
          className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] active:scale-95 dark:text-zinc-500 dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
        >
          <IconExport />
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Insert image"
          aria-label="Insert image"
          className="flex size-8 items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] active:scale-95 dark:text-zinc-500 dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
        >
          <IconImage />
        </button>
        <button
          type="button"
          onClick={() => setTheme(!isDark)}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex size-8 items-center justify-center rounded-md text-[13px] text-zinc-400 transition-all duration-100 hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] active:scale-95 dark:text-zinc-500 dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
        >
          <span aria-hidden>{isDark ? '☀' : '☾'}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void insertImageFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <Minimap elements={elements} />
      <Toolbar elements={elements} onElementUpdate={(el) => trackedUpserts([el], 'edit style')} onElementsUpdate={(els) => trackedUpserts(els, 'edit style')} />
      <ZoomControl onFit={handleZoomFit} onFitSelection={handleZoomSelection} />

      {/* Export Modal */}
      {showExport && (
        <Suspense fallback={null}>
          <ExportModal
            elements={elements}
            selectedIds={selectedIds}
            onClose={() => setShowExport(false)}
          />
        </Suspense>
      )}

      {/* Context Menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={closeCtxMenu}>
          <MenuItem onClick={flipHorizontal} disabled={!hasSelection} shortcut="⇋">
            <FlipHIcon /> Flip Horizontal
          </MenuItem>
          <MenuItem onClick={flipVertical} disabled={!hasSelection} shortcut="⇅">
            <FlipVIcon /> Flip Vertical
          </MenuItem>
          <MenuSeparator />

          <MenuItem
            onClick={() => {
              if (selectedElement) {
                bringToFrontTracked(selectedElement.id)
              } else if (hasMultiSel) {
                bringSelectedToFront()
              }
            }}
            disabled={!hasSelection}
          >
            <BringFrontIcon /> Bring to Front
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                bringForwardTracked(selectedElement.id)
              }
            }}
            disabled={!selectedElement}
          >
            <BringForwardIcon /> Bring Forward
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                sendBackwardTracked(selectedElement.id)
              }
            }}
            disabled={!selectedElement}
          >
            <SendBackwardIcon /> Send Backward
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedElement) {
                sendToBackTracked(selectedElement.id)
              } else if (hasMultiSel) {
                sendSelectedToBack()
              }
            }}
            disabled={!hasSelection}
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

          <MenuItem onClick={handleCopy} disabled={!hasSelection} shortcut="⌘C">
            <CopyIcon /> Copy
          </MenuItem>
          <MenuItem onClick={handleCut} disabled={!hasSelection} shortcut="⌘X">
            <CutIcon /> Cut
          </MenuItem>
          <MenuItem onClick={handlePaste} disabled={clipboardElements.length === 0} shortcut="⌘V">
            <PasteIcon /> Paste
          </MenuItem>
          <MenuItem onClick={handleDuplicate} disabled={!hasSelection} shortcut="⌘D">
            <PasteIcon /> Duplicate
          </MenuItem>
          <MenuItem onClick={handleDelete} disabled={!hasSelection} shortcut="⌫">
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
