import { memo } from 'react'
import { useSelector } from '@tanstack/react-store'
import {
  canvasStore,
  setTool,
  setStrokeColor,
  setBackgroundColor,
  setStrokeWidth,
  setOpacity,
  setBowing,
  setStrokeStyle,
  setRoughness,
  setFontSize,
  setFontFamily,
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
  IconLaser,
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
  { tool: 'laser', label: 'Laser', icon: <IconLaser />, shortcut: 'K' },
  { tool: 'pan', label: 'Pan', icon: <IconPan />, shortcut: 'H' },
]

const FONT_SIZES = [16, 20, 28, 36]
const FONT_FAMILIES = ['sans-serif', 'serif', 'monospace']

interface ToolbarProps {
  elements: Element[]
  onElementUpdate: (element: Element) => void
  onElementsUpdate: (elements: Element[]) => void
}

export const Toolbar = memo(function Toolbar({ elements, onElementUpdate, onElementsUpdate }: ToolbarProps): ReactNode {
  const activeTool = useSelector(canvasStore, (s) => s.tool)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  const storeStroke = useSelector(canvasStore, (s) => s.strokeColor)
  const storeFill = useSelector(canvasStore, (s) => s.backgroundColor)
  const storeWidth = useSelector(canvasStore, (s) => s.strokeWidth)
  const storeOpacity = useSelector(canvasStore, (s) => s.opacity)
  const storeBowing = useSelector(canvasStore, (s) => s.bowing)
  const storeStyle = useSelector(canvasStore, (s) => s.strokeStyle)
  const storeRough = useSelector(canvasStore, (s) => s.roughness)
  const storeFontSize = useSelector(canvasStore, (s) => s.fontSize)
  const storeFontFamily = useSelector(canvasStore, (s) => s.fontFamily)

  const selected = elements.filter((e) => selectedIds.includes(e.id))
  const first = selected.length === 1 ? selected[0] : null
  const isText = first?.type === 'text' || (selected.length === 0 && activeTool === 'text')

  // Display values: single selection → element, multi → mixed (fall back to store).
  const strokeColor = first?.strokeColor ?? storeStroke
  const fillColor = first?.backgroundColor ?? storeFill
  const strokeWidth = first?.strokeWidth ?? storeWidth
  const opacity = first?.opacity ?? storeOpacity
  const bowing = first?.bowing ?? storeBowing
  const strokeStyle = first?.strokeStyle ?? storeStyle
  const roughness = first?.roughness ?? storeRough
  const fontSize = first?.fontSize ?? storeFontSize
  const fontFamily = first?.fontFamily ?? storeFontFamily

  function update(partial: Partial<Element>) {
    if (first) {
      onElementUpdate({ ...first, ...partial })
    } else if (selected.length > 1) {
      onElementsUpdate(selected.map((e) => ({ ...e, ...partial })))
    }
  }

  return (
    <>
      {/* Left tool strip */}
      <div
        role="toolbar"
        aria-label="Drawing tools"
        className="pointer-events-auto absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-px rounded-lg border border-black/[0.06] bg-white/95 p-1 backdrop-blur-xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.10),0_1px_3px_-1px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35),0_1px_3px_-1px_rgba(0,0,0,0.2)]"
      >
        {tools.map((t) => (
          <IconButton
            key={t.tool}
            active={activeTool === t.tool}
            onClick={() => setTool(t.tool)}
            title={`${t.label} — ${t.shortcut}`}
            ariaLabel={`${t.label} tool`}
            size="xs"
          >
            {t.icon}
          </IconButton>
        ))}
      </div>

      {/* Bottom bar — wraps on small screens */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 -translate-x-1/2 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-2 rounded-lg border border-black/[0.06] bg-white/95 px-2.5 py-1.5 backdrop-blur-xl shadow-[0_4px_16px_-4px_rgba(0,0,0,0.10),0_1px_3px_-1px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.35),0_1px_3px_-1px_rgba(0,0,0,0.2)]">
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Stroke</span>
        <ColorPicker
          label="stroke"
          color={strokeColor}
          strokeWidth={strokeWidth}
          opacity={opacity}
          bowing={bowing}
          onColorChange={(c) => {
            setStrokeColor(c)
            update({ strokeColor: c })
          }}
          onStrokeWidthChange={(w) => {
            setStrokeWidth(w)
            update({ strokeWidth: w })
          }}
          onOpacityChange={(o) => {
            setOpacity(o)
            update({ opacity: o })
          }}
          onBowingChange={(b) => {
            setBowing(b)
            update({ bowing: b })
          }}
        />
        <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Fill</span>
        <ColorPicker
          label="fill"
          color={fillColor}
          strokeWidth={1}
          opacity={100}
          bowing={1}
          onColorChange={(c) => {
            setBackgroundColor(c)
            update({ backgroundColor: c })
          }}
          onStrokeWidthChange={() => {}}
          onOpacityChange={() => {}}
          onBowingChange={() => {}}
        />
        <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
        {/* Stroke style */}
        <label className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Style</span>
          <select
            aria-label="Stroke style"
            value={strokeStyle}
            onChange={(e) => {
              const v = e.target.value as Element['strokeStyle']
              setStrokeStyle(v)
              update({ strokeStyle: v })
            }}
            className="rounded bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Sketch</span>
          <select
            aria-label="Sketch roughness"
            value={roughness}
            onChange={(e) => {
              const v = Number(e.target.value)
              setRoughness(v)
              update({ roughness: v })
            }}
            className="rounded bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300"
          >
            <option value={0}>Neat</option>
            <option value={1}>Natural</option>
            <option value={2}>Sketchy</option>
          </select>
        </label>
        {isText && (
          <>
            <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
            <label className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Size</span>
              <select
                aria-label="Font size"
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setFontSize(v)
                  update({ fontSize: v })
                }}
                className="rounded bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Font</span>
              <select
                aria-label="Font family"
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value)
                  update({ fontFamily: e.target.value })
                }}
                className="rounded bg-transparent text-[11px] text-zinc-600 dark:text-zinc-300"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {selected.length > 1 && (
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            {selected.length} selected — edits apply to all
          </span>
        )}
      </div>
    </>
  )
})
