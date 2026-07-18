import { useSelector } from '@tanstack/react-store'
import { canvasStore, setTool } from '../stores/canvas-store'
import { IconButton } from './ui/icon-button'
import { VSeparator } from './ui/separator'
import { Panel } from './ui/panel'
import { ColorPicker } from './color-picker'
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
import type { ReactNode } from 'react'
import type { Tool } from '../types'

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
    <Panel className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1.5">
      {tools.map((t) => (
        <IconButton
          key={t.tool}
          active={activeTool === t.tool}
          onClick={() => setTool(t.tool)}
          title={`${t.label} — ${t.shortcut}`}
        >
          {t.icon}
        </IconButton>
      ))}
      <VSeparator className="mx-1.5" />
      <ColorPicker label="stroke" />
      <VSeparator className="mx-1.5" />
      <ColorPicker label="fill" />
    </Panel>
  )
}
