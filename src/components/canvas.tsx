import { useSelector } from '@tanstack/react-store'
import { canvasStore } from '../stores/canvas-store'
import { useElements } from '../hooks/use-elements'
import { useKeyboard } from '../hooks/use-keyboard'
import { useCanvas } from '../hooks/use-canvas'
import { Toolbar } from './toolbar'
import { ZoomControl } from './zoom-control'
import type { ReactNode } from 'react'

const TOOL_CURSOR: Record<string, string> = {
  select: 'default',
  rectangle: 'crosshair',
  diamond: 'crosshair',
  ellipse: 'crosshair',
  arrow: 'crosshair',
  line: 'crosshair',
  pencil: 'crosshair',
  text: 'text',
  pan: 'grab',
}

export function CanvasView(): ReactNode {
  const { elements, upsertElement, upsertElements } = useElements()
  const tool = useSelector(canvasStore, (s) => s.tool)
  useKeyboard()

  const { canvasRef, handlePointerDown, handlePointerMove, handlePointerUp } =
    useCanvas({
      elements,
      onElementCreate: upsertElement,
      onElementsUpdate: upsertElements,
    })

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <canvas
        ref={canvasRef}
        className="touch-none"
        style={{ cursor: TOOL_CURSOR[tool] ?? 'default' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <Toolbar />
      <ZoomControl />
    </div>
  )
}
