import { useEffect } from 'react'
import { setTool, zoomAtPoint } from '../stores/canvas-store'
import type { Tool, Element } from '../types'

const toolKeyMap: Record<string, Tool> = {
  v: 'select',
  r: 'rectangle',
  d: 'diamond',
  o: 'ellipse',
  a: 'arrow',
  l: 'line',
  p: 'pencil',
  t: 'text',
  h: 'pan',
}

export interface ClipboardActions {
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelected: () => void
}

let clipboardActions: ClipboardActions = {
  copy: () => {},
  cut: () => {},
  paste: () => {},
  deleteSelected: () => {},
}

export function setClipboardActions(actions: Partial<ClipboardActions>) {
  Object.assign(clipboardActions, actions)
}

// In-app clipboard for copy/paste (not system clipboard)
export let clipboardElements: Element[] = []

export function copyToClipboard(elements: Element[]) {
  clipboardElements = elements.map((e) => ({ ...e, id: crypto.randomUUID() }))
}

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey

      if (key === 'escape') {
        setTool('select')
        return
      }

      if (!mod && key in toolKeyMap) {
        setTool(toolKeyMap[key])
        return
      }

      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        clipboardActions.deleteSelected()
        return
      }

      if (mod) {
        switch (key) {
          case 'c':
            e.preventDefault()
            clipboardActions.copy()
            break
          case 'x':
            e.preventDefault()
            clipboardActions.cut()
            break
          case 'v':
            e.preventDefault()
            clipboardActions.paste()
            break
          case '=':
          case '+':
            e.preventDefault()
            zoomAtPoint(Math.min(5, getCurrentZoom() + 0.1))
            break
          case '-':
            e.preventDefault()
            zoomAtPoint(Math.max(0.1, getCurrentZoom() - 0.1))
            break
          case '0':
            e.preventDefault()
            zoomAtPoint(1)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}

function getCurrentZoom(): number {
  try {
    return JSON.parse(localStorage.getItem('calidraw-pov') ?? '{}').zoom ?? 1
  } catch {
    return 1
  }
}
