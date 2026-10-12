import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
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

  const doneRef = useRef(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      el.focus({ preventScroll: true })
    } catch {
      el.focus()
    }
    try {
      el.setSelectionRange(el.value.length, el.value.length)
    } catch {

    }
    const focus = () => {
      try {
        if (document.activeElement !== el) el.focus({ preventScroll: true })
      } catch {
        try {
          el.focus()
        } catch {

        }
      }
    }
    const raf = requestAnimationFrame(focus)
    const t0 = window.setTimeout(focus, 0)
    const t1 = window.setTimeout(focus, 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [])

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

      onSave(element.id, value, Math.ceil(maxW / s.zoom), Math.ceil(lines.length * lineHeight / s.zoom))
    } else {
      onCancel()
    }
  }, [value, element, onSave, onCancel])

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
    if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation()
    if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commit()
    }
  }, [commit, cancel])

  const s = canvasStore.state
  const fontSize = (element.fontSize ?? 20) * s.zoom

  const padX = 8
  const padY = 6

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => {
        const next = e.relatedTarget as HTMLElement | null
        if (next?.tagName === 'CANVAS' || next?.tagName === 'BODY' || next === null) {
          requestAnimationFrame(() => {
            const el = ref.current
            if (!el || doneRef.current) return
            if (document.activeElement !== el) {
              try {
                el.focus({ preventScroll: true })
              } catch {
                el.focus()
              }
            }
          })
          return
        }
        commit()
      }}
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
      autoFocus
    />
  )
}
