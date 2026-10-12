import { useEffect } from 'react'
import { canvasStore, setTool, zoomAtPoint } from '../stores/canvas-store'
import type { Tool, Element } from '../types'

const toolKeyMap: Record<string, Tool> = {
  v: 'select',
  r: 'rectangle',
  d: 'diamond',
  o: 'ellipse',
  c: 'ellipse',
  '4': 'ellipse',
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
  zoomFit?: () => void
  zoomSelection?: () => void
  exportCanvas?: () => void
}

const clipboardActions: ClipboardActions = {
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

export let clipboardElements: Element[] = []

export function copyToClipboard(elements: Element[]) {
  clipboardElements = elements.map((e) => ({ ...e, id: crypto.randomUUID() }))
}

let spacePanPrevTool: Tool | null = null

function isEditableTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (t.isContentEditable) return true
  return false
}

function activeElementIsEditable(): boolean {
  try {
    const a = document.activeElement as HTMLElement | null
    if (!a) return false
    const tag = a.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || a.isContentEditable
  } catch {
    return false
  }
}

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const mod = e.ctrlKey || e.metaKey
      const shift = e.shiftKey

      if (e.isComposing || e.keyCode === 229) return

      if (canvasStore.state.editingTextId) return

      if (isEditableTarget(e) || activeElementIsEditable()) return

      if (key === 'escape') {
        setTool('select')
        return
      }

      if (e.key === ' ' && !mod) {
        e.preventDefault()
        if (spacePanPrevTool === null) {
          spacePanPrevTool = canvasStore.state.tool as Tool
          setTool('pan')
        }
        return
      }

      if (!mod && !shift && key in toolKeyMap) {
        setTool(toolKeyMap[key])
        return
      }

      if (!mod && shift && (e.key === '!' || e.key === '1')) {
        e.preventDefault()
        clipboardActions.zoomFit?.()
        return
      }
      if (!mod && shift && (e.key === '@' || e.key === '2')) {
        e.preventDefault()
        clipboardActions.zoomSelection?.()
        return
      }

      if (key === 'delete' || key === 'backspace') {
        e.preventDefault()
        clipboardActions.deleteSelected()
        return
      }

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
          case 'y':
            e.preventDefault()
            clipboardActions.redo()
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
            return
          case 'd':
            e.preventDefault()
            clipboardActions.duplicate()
            return
          case 'e':
            e.preventDefault()
            clipboardActions.exportCanvas?.()
            return
          case '=':
          case '+':
            e.preventDefault()
            zoomAtPoint(Math.min(5, canvasStore.state.zoom + 0.1))
            return
          case '-':
            e.preventDefault()
            zoomAtPoint(Math.max(0.1, canvasStore.state.zoom - 0.1))
            return
          case '0':
            e.preventDefault()
            zoomAtPoint(1)
            return
        }
      }

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

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
}
