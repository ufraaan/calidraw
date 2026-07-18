import { useSelector } from '@tanstack/react-store'
import { canvasStore, setTool } from '../stores/canvas-store'
import { IconButton } from './ui/icon-button'
import type { ReactNode } from 'react'
import type { Tool } from '../types'
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

export function Toolbar(): ReactNode {
  const activeTool = useSelector(canvasStore, (s) => s.tool)

  return (
    <>
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
      <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg border border-black/[0.04] bg-white/70 px-3 py-1.5 backdrop-blur-xl shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-zinc-900/70 dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Stroke</span>
          <ColorPicker label="stroke" />
        </div>
        <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">Fill</span>
          <ColorPicker label="fill" />
        </div>
      </div>
    </>
  )
}
