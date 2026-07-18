import { useRef, useEffect, useState, useCallback } from 'react'
import { canvasStore } from '../stores/canvas-store'
import type { Element } from '../types'
import type { ReactNode } from 'react'

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
      // We use a temporary canvas to measure the text so the element
      // bounding box matches what the renderer will draw.
      const s = canvasStore.state
      const fontSize = (element.fontSize ?? 20) * s.zoom
      const font = `${fontSize}px ${element.fontFamily ?? 'sans-serif'}`
      const lines = value.split('\n')
      const lineHeight = fontSize * 1.2
      let maxW = 20
      const c = document.createElement('canvas')
      const ctx = c.getContext('2d')!
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
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    // Enter (without Shift) → save & exit
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // We need to call commit synchronously so the blur doesn't also fire
      commit()
    }
    // Shift+Enter → let the browser insert a newline (default behavior)
  }, [commit, onCancel])

  const s = canvasStore.state
  const fontSize = (element.fontSize ?? 20) * s.zoom

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      className="absolute overflow-hidden border-0 bg-transparent p-0 outline-none"
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
        // Slight transparent background to distinguish from canvas
        background: 'rgba(255,255,255,0.04)',
      }}
      rows={1}
      spellCheck={false}
      autoComplete="off"
      autoCorrect="off"
    />
  )
}
