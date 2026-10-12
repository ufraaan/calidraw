import { useRef, useEffect, useState, useCallback } from 'react'
import type { MutableRefObject } from 'react'
import { canvasStore } from '../stores/canvas-store'
import type { Element } from '../types'
import type { ReactNode } from 'react'

let measureCanvas: HTMLCanvasElement | null = null
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCanvas) measureCanvas = document.createElement('canvas')
  return measureCanvas.getContext('2d')!
}

interface TextEditorProps {
  element: Element
  isNew: boolean
  commitRef: MutableRefObject<(() => void) | null>
  onSave: (id: string, text: string, width: number, height: number) => void
  onCancel: () => void
}

export function TextEditor({ element, isNew, commitRef, onSave, onCancel }: TextEditorProps): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(element.text ?? '')
  // Guard against double-commit (e.g. Cmd+Enter then blur on unmount).
  const doneRef = useRef(false)

  // Focus + put cursor at end
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  // Auto-grow the textarea to match content
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
    el.style.width = 'auto'
    el.style.width = Math.max(el.scrollWidth + 2, 20) + 'px'
  }, [value])

  const commit = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    if (value.trim()) {
      // Compute the dimensions from the text content.
      // We use a shared offscreen canvas to measure so the element
      // bounding box matches what the renderer will draw.
      const s = canvasStore.state
      const fontSize = (element.fontSize ?? 20) * s.zoom
      const font = `${fontSize}px ${element.fontFamily ?? 'sans-serif'}`
      const lines = value.split('\n')
      const lineHeight = fontSize * 1.2
      let maxW = 20
      const ctx = getMeasureCtx()
      ctx.font = font
      for (const line of lines) {
        const m = ctx.measureText(line)
        if (m.width > maxW) maxW = m.width
      }
      // Divide by zoom to store in canvas-space units
      onSave(element.id, value, Math.ceil(maxW / s.zoom), Math.ceil(lines.length * lineHeight / s.zoom))
    } else {
      onCancel()
    }
  }, [value, element, onSave, onCancel])

  // Expose commit to the parent so click-away / tool switches can
  // save explicitly instead of relying on the blur race.
  useEffect(() => {
    commitRef.current = commit
    return () => {
      commitRef.current = null
    }
  }, [commit, commitRef])

  const cancel = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }, [onCancel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
      return
    }
    // Plain Enter → save & exit. Shift+Enter → newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
  }, [commit, cancel])

  const s = canvasStore.state
  const fontSize = (element.fontSize ?? 20) * s.zoom
  // Editor chrome padding — offset the position so the typed text
  // sits exactly where the canvas renderer will draw it.
  const padX = 8
  const padY = 6

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => e.stopPropagation()}
      onBlur={commit}
      aria-label="Text element editor. Press Enter to save, Shift Enter for a new line, Escape to cancel."
      className="absolute z-10 overflow-hidden rounded-sm border-0 outline-none"
      style={{
        left: element.x * s.zoom + s.offsetX - padX,
        top: element.y * s.zoom + s.offsetY - padY,
        fontFamily: element.fontFamily ?? 'sans-serif',
        fontSize,
        lineHeight: 1.2,
        color: element.strokeColor,
        caretColor: element.strokeColor,
        minWidth: 60,
        minHeight: fontSize + padY * 2,
        padding: `${padY}px ${padX}px`,
        margin: 0,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        outline: '1.5px solid rgba(232,160,122,0.8)',
        outlineOffset: 0,
        resize: 'none',
        background: s.isDark ? 'rgba(24,24,27,0.92)' : 'rgba(255,255,255,0.95)',
        boxShadow: '0 4px 16px -4px rgba(0,0,0,0.15)',
      }}
      rows={1}
      placeholder={isNew ? 'type here' : undefined}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
    />
  )
}
