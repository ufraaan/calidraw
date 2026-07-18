import { useRef, useEffect, useState } from 'react'
import { canvasStore } from '../stores/canvas-store'
import type { Element } from '../types'
import type { ReactNode } from 'react'

interface TextEditorProps {
  element: Element
  onSave: (id: string, text: string) => void
  onCancel: () => void
}

export function TextEditor({ element, onSave, onCancel }: TextEditorProps): ReactNode {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState(element.text ?? '')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
  }

  const commit = () => {
    if (value.trim()) {
      onSave(element.id, value)
    } else {
      onCancel()
    }
  }

  const s = canvasStore.state
  const fontSize = (element.fontSize ?? 20) * s.zoom

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
      style={{
        left: element.x * s.zoom + s.offsetX,
        top: element.y * s.zoom + s.offsetY,
        fontFamily: element.fontFamily ?? 'sans-serif',
        fontSize,
        lineHeight: 1.2,
        color: element.strokeColor,
        minWidth: 20,
        minHeight: fontSize + 4,
        width: element.width * s.zoom || 200,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'break-word',
      }}
      rows={1}
    />
  )
}
