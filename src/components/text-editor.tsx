import { useRef, useEffect, useState, useCallback } from 'react'
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
  onSave: (id: string, text: string, width: number, height: number) => void
  onCancel: () => void
}

export function TextEditor({ element, onSave, onCancel }: TextEditorProps): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(element.text ?? '')

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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    // Cmd/Ctrl+Enter → save & exit. Plain Enter inserts a newline.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      commit()
    }
  }, [commit, onCancel])

  const s = canvasStore.state
  const fontSize = (element.fontSize ?? 20) * s.zoom

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => e.stopPropagation()}
      onBlur={commit}
      aria-label="Text element editor. Press Control Enter to save, Escape to cancel."
      className="absolute overflow-hidden border-0 p-0 outline-none dark:bg-white/[0.06]"
      style={{
        left: element.x * s.zoom + s.offsetX,
        top: element.y * s.zoom + s.offsetY,
        fontFamily: element.fontFamily ?? 'sans-serif',
        fontSize,
        lineHeight: 1.2,
        color: element.strokeColor,
        caretColor: element.strokeColor,
        minWidth: 20,
        minHeight: fontSize + 4,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
        // A faint dashed border so the user can see where the text area is
        outline: '1px dashed rgba(232,160,122,0.5)',
        outlineOffset: 0,
        resize: 'none',
        background: 'rgba(127,127,127,0.08)',
      }}
      rows={1}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
    />
  )
}
