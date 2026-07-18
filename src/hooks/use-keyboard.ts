import { useEffect } from 'react'
import { setTool, zoomAtPoint } from '../stores/canvas-store'
import type { Tool } from '../types'

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

export function useKeyboard() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const key = e.key.toLowerCase()

      if (key === 'escape') {
        setTool('select')
        return
      }

      if (key in toolKeyMap) {
        setTool(toolKeyMap[key])
        return
      }

      if (e.ctrlKey || e.metaKey) {
        const currentZoom = parseFloat(localStorage.getItem('calidraw-zoom') ?? '1')
        switch (key) {
          case '=':
          case '+':
            e.preventDefault()
            zoomAtPoint(Math.min(5, currentZoom + 0.1))
            break
          case '-':
            e.preventDefault()
            zoomAtPoint(Math.max(0.1, currentZoom - 0.1))
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
