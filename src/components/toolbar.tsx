import { useSelector } from '@tanstack/react-store'
import { canvasStore, setTool } from '../stores/canvas-store'
import {
  setStrokeColor,
  setBackgroundColor,
  setStrokeWidth,
  setOpacity,
} from '../stores/canvas-store'
import { IconButton } from './ui/icon-button'
import type { ReactNode } from 'react'
import type { Tool, Element } from '../types'
import {
  IconSelect,
  IconRect,
  IconDiamond,
  IconEllipse,
  IconArrow,
  IconLine,
  IconPencil,
  IconText,
  IconPan,
} from './ui/icons'
import { ColorPicker } from './color-picker'

const tools: { tool: Tool; label: string; icon: ReactNode; shortcut: string }[] = [
  { tool: 'select', label: 'Select', icon: <IconSelect />, shortcut: 'V' },
  { tool: 'rectangle', label: 'Rectangle', icon: <IconRect />, shortcut: 'R' },
  { tool: 'diamond', label: 'Diamond', icon: <IconDiamond />, shortcut: 'D' },
  { tool: 'ellipse', label: 'Ellipse', icon: <IconEllipse />, shortcut: 'O' },
  { tool: 'arrow', label: 'Arrow', icon: <IconArrow />, shortcut: 'A' },
  { tool: 'line', label: 'Line', icon: <IconLine />, shortcut: 'L' },
  { tool: 'pencil', label: 'Pencil', icon: <IconPencil />, shortcut: 'P' },
  { tool: 'text', label: 'Text', icon: <IconText />, shortcut: 'T' },
  { tool: 'pan', label: 'Pan', icon: <IconPan />, shortcut: 'H' },
]

interface ToolbarProps {
  elements: Element[]
  onElementUpdate: (element: Element) => void
}

export function Toolbar({ elements, onElementUpdate }: ToolbarProps): ReactNode {
  const activeTool = useSelector(canvasStore, (s) => s.tool)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  const storeStroke = useSelector(canvasStore, (s) => s.strokeColor)
  const storeFill = useSelector(canvasStore, (s) => s.backgroundColor)
  const storeWidth = useSelector(canvasStore, (s) => s.strokeWidth)
  const storeOpacity = useSelector(canvasStore, (s) => s.opacity)

  const selectedElement = selectedIds.length === 1
    ? elements.find((e) => e.id === selectedIds[0]) ?? null
    : null

  // Derive display values from selected element or store defaults
  const strokeColor = selectedElement?.strokeColor ?? storeStroke
  const fillColor = selectedElement?.backgroundColor ?? storeFill
  const strokeWidth = selectedElement?.strokeWidth ?? storeWidth
  const opacity = selectedElement?.opacity ?? storeOpacity

  function updateElement(partial: Partial<Element>) {
    if (selectedElement) {
      onElementUpdate({ ...selectedElement, ...partial })
    }
  }

  return (
    <>
      {/* Left tool strip */}
      <div className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-px rounded-lg border border-black/[0.04] bg-white/70 p-1 backdrop-blur-xl shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-zinc-900/70 dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]">
        {tools.map((t) => (
          <IconButton
            key={t.tool}
            active={activeTool === t.tool}
            onClick={() => setTool(t.tool)}
            title={`${t.label} — ${t.shortcut}`}
            size="xs"
          >
            {t.icon}
          </IconButton>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-black/[0.04] bg-white/70 px-2.5 py-1.5 backdrop-blur-xl shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-zinc-900/70 dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]">
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Stroke</span>
        <ColorPicker
          label="stroke"
          color={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          onColorChange={(c) => {
            setStrokeColor(c)
            updateElement({ strokeColor: c })
          }}
          onStrokeWidthChange={(w) => {
            setStrokeWidth(w)
            updateElement({ strokeWidth: w })
          }}
          onOpacityChange={(o) => {
            setOpacity(o)
            updateElement({ opacity: o })
          }}
        />
        <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Fill</span>
        <ColorPicker
          label="fill"
          color={fillColor}
          strokeWidth={1}
          opacity={100}
          onColorChange={(c) => {
            setBackgroundColor(c)
            updateElement({ backgroundColor: c })
          }}
          onStrokeWidthChange={() => {}}
          onOpacityChange={() => {}}
        />
      </div>
    </>
  )
}
