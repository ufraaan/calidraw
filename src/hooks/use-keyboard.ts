import { useEffect } from 'react'
import { canvasStore, setTool, zoomAtPoint } from '../stores/canvas-store'
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
  k: 'laser',
}

export interface ClipboardActions {
  copy: () => void
  cut: () => void
  paste: () => void
  deleteSelected: () => void
  selectAll: () => void
  duplicate: () => void
  nudge: (dx: number, dy: number) => void
  undo: () => void
  redo: () => void
}

let clipboardActions: ClipboardActions = {
  copy: () => {},
  cut: () => {},
  paste: () => {},
  deleteSelected: () => {},
  selectAll: () => {},
  duplicate: () => {},
  nudge: () => {},
  undo: () => {},
  redo: () => {},
}

export function setClipboardActions(actions: Partial<ClipboardActions>) {
  Object.assign(clipboardActions, actions)
}

// In-app clipboard for copy/paste (not system clipboard)
export let clipboardElements: Element[] = []

export function copyToClipboard(elements: Element[]) {
  clipboardElements = elements.map((e) => ({ ...e, id: crypto.randomUUID() }))
}

let spacePanPrevTool: Tool | null = null

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const shift = e.shiftKey

      // Space → temporary pan (skip if typing in an input)
      if (e.key === ' ' && !mod) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        if (spacePanPrevTool === null) {
          spacePanPrevTool = canvasStore.state.tool as Tool
          setTool('pan')
        }
        return
      }

      // Escape → select
      if (key === 'escape') {
        setTool('select')
        return
      }

      // Tool shortcuts (only when no modifier is held)
      if (!mod && !shift && key in toolKeyMap) {
        setTool(toolKeyMap[key])
        return
      }

      // Delete / Backspace
      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        clipboardActions.deleteSelected()
        return
      }

      // ── Modifier-based shortcuts ──────────────────────────
      if (mod) {
        switch (key) {
          case 'z':
            e.preventDefault()
            if (shift) {
              clipboardActions.redo()
            } else {
              clipboardActions.undo()
            }
            return
          case 'a':
            e.preventDefault()
            clipboardActions.selectAll()
            return
          case 'c':
            e.preventDefault()
            clipboardActions.copy()
            return
          case 'x':
            e.preventDefault()
            clipboardActions.cut()
            return
          case 'v':
            e.preventDefault()
            clipboardActions.paste()
            return
          case 'd':
            e.preventDefault()
            clipboardActions.duplicate()
            return
          case '=':
          case '+':
            e.preventDefault()
            zoomAtPoint(Math.min(5, getCurrentZoom() + 0.1))
            return
          case '-':
            e.preventDefault()
            zoomAtPoint(Math.max(0.1, getCurrentZoom() - 0.1))
            return
          case '0':
            e.preventDefault()
            zoomAtPoint(1)
            return
        }
      }

      // ── Arrow keys (nudge) ────────────────────────────────
      const nudgeStep = shift ? 10 : 1
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          clipboardActions.nudge(0, -nudgeStep)
          return
        case 'ArrowDown':
          e.preventDefault()
          clipboardActions.nudge(0, nudgeStep)
          return
        case 'ArrowLeft':
          e.preventDefault()
          clipboardActions.nudge(-nudgeStep, 0)
          return
        case 'ArrowRight':
          e.preventDefault()
          clipboardActions.nudge(nudgeStep, 0)
          return
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ' && spacePanPrevTool !== null) {
        e.preventDefault()
        setTool(spacePanPrevTool)
        spacePanPrevTool = null
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
}

function getCurrentZoom(): number {
  try {
    return JSON.parse(localStorage.getItem('calidraw-pov') ?? '{}').zoom ?? 1
  } catch {
    return 1
  }
}
