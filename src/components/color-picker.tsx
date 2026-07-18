import { useSelector } from '@tanstack/react-store'
import {
  canvasStore,
  setStrokeColor,
  setBackgroundColor,
  setStrokeWidth,
  setOpacity,
} from '../stores/canvas-store'
import type { ReactNode } from 'react'

const swatches = [
  '#1e1e1e', '#e03131', '#e8590c', '#f08c00',
  '#2f9e44', '#099268', '#1971c2', '#6741d9',
  '#e64980', '#ffffff',
]

export function ColorPicker({ label }: { label: string }): ReactNode {
  const strokeColor = useSelector(canvasStore, (s) => s.strokeColor)
  const bgColor = useSelector(canvasStore, (s) => s.backgroundColor)
  const strokeWidth = useSelector(canvasStore, (s) => s.strokeWidth)
  const opacity = useSelector(canvasStore, (s) => s.opacity)

  const currentColor = label === 'stroke' ? strokeColor : bgColor
  const setColor = label === 'stroke' ? setStrokeColor : setBackgroundColor

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={currentColor === 'transparent' ? '#ffffff' : currentColor}
        onChange={(e) => setColor(e.target.value)}
        className="size-5 cursor-pointer rounded border border-black/[0.06] bg-transparent p-0 dark:border-white/[0.06]"
        title={label === 'stroke' ? 'Stroke color' : 'Fill color'}
      />
      <div className="flex items-center gap-0.5">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => setColor(c)}
            className={`size-3.5 rounded-sm transition-transform hover:scale-110 ${
              currentColor === c
                ? 'ring-1 ring-black/20 dark:ring-white/30 ring-offset-1 ring-offset-transparent'
                : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {label === 'fill' && (
          <button
            type="button"
            aria-label="No fill"
            onClick={() => setBackgroundColor('transparent')}
            className={`flex size-3.5 items-center justify-center rounded-sm border border-black/[0.08] text-[8px] font-bold leading-none text-zinc-300 dark:border-white/[0.12] dark:text-zinc-600 ${
              bgColor === 'transparent' ? 'ring-1 ring-black/20 dark:ring-white/30 ring-offset-1' : ''
            }`}
          >
            /
          </button>
        )}
      </div>
      <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
      <div className="flex items-center gap-0.5">
        {[1, 2, 4].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setStrokeWidth(w)}
            className={`flex size-5 items-center justify-center rounded text-[10px] font-medium leading-none ${
              strokeWidth === w
                ? 'bg-black/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
            title={`${w}px`}
          >
            {w}
          </button>
        ))}
      </div>
      <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
      <div className="flex items-center gap-0.5">
        {[60, 80, 100].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOpacity(o)}
            className={`flex size-5 items-center justify-center rounded text-[10px] font-medium leading-none ${
              opacity === o
                ? 'bg-black/[0.04] text-zinc-700 dark:bg-white/[0.06] dark:text-zinc-200'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
            title={`${o}%`}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
