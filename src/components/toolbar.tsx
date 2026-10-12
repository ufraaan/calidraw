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
        className="ui-panel pointer-events-auto absolute left-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5 p-2"
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

      {/* Bottom style bar — wraps on small screens */}
      <div className="ui-panel pointer-events-auto absolute bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 px-3 py-2">
        <span className="ui-label">Stroke</span>
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
        <div className="ui-div h-4 w-px" />
        <span className="ui-label">Fill</span>
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
        <div className="ui-div h-4 w-px" />
        {/* Stroke style */}
        <label className="flex items-center gap-1">
          <span className="ui-label">Style</span>
          <select
            aria-label="Stroke style"
            value={strokeStyle}
            onChange={(e) => {
              const v = e.target.value as Element['strokeStyle']
              setStrokeStyle(v)
              update({ strokeStyle: v })
            }}
            className="ui-select"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label className="flex items-center gap-1">
          <span className="ui-label">Sketch</span>
          <select
            aria-label="Sketch roughness"
            value={roughness}
            onChange={(e) => {
              const v = Number(e.target.value)
              setRoughness(v)
              update({ roughness: v })
            }}
            className="ui-select"
          >
            <option value={0}>Neat</option>
            <option value={1}>Natural</option>
            <option value={2}>Sketchy</option>
          </select>
        </label>
        {isText && (
          <>
            <div className="ui-div h-4 w-px" />
            <label className="flex items-center gap-1">
              <span className="ui-label">Size</span>
              <select
                aria-label="Font size"
                value={fontSize}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setFontSize(v)
                  update({ fontSize: v })
                }}
                className="ui-select"
              >
                {FONT_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="ui-label">Font</span>
              <select
                aria-label="Font family"
                value={fontFamily}
                onChange={(e) => {
                  setFontFamily(e.target.value)
                  update({ fontFamily: e.target.value })
                }}
                className="ui-select"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {selected.length > 1 && (
          <span className="ui-faint ui-nums">
            {selected.length} selected — edits apply to all
          </span>
        )}
      </div>
    </>
  )
})
