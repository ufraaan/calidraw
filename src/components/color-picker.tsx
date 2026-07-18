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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={currentColor === 'transparent' ? '#ffffff' : currentColor}
          onChange={(e) => setColor(e.target.value)}
          className="size-6 cursor-pointer rounded-md border border-zinc-200 bg-transparent p-0 dark:border-zinc-700"
          title={label === 'stroke' ? 'Stroke color' : 'Fill color'}
        />
        <div className="flex gap-0.5">
          {swatches.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setColor(c)}
              className={`size-4 rounded-full border transition-transform hover:scale-110 ${
                currentColor === c
                  ? 'border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100'
                  : 'border-zinc-200 dark:border-zinc-600'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          {label === 'fill' && (
            <button
              type="button"
              aria-label="No fill"
              onClick={() => setBackgroundColor('transparent')}
              className={`flex size-4 items-center justify-center rounded-full border border-zinc-300 text-[9px] font-bold leading-none text-zinc-400 dark:border-zinc-600 ${
                bgColor === 'transparent' ? 'ring-1 ring-zinc-900 dark:ring-zinc-100' : ''
              }`}
            >
              /
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {[1, 2, 4].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setStrokeWidth(w)}
              className={`flex size-4.5 items-center justify-center rounded text-[10px] font-medium ${
                strokeWidth === w
                  ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={`${w}px`}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5">
          {[60, 80, 100].map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOpacity(o)}
              className={`flex size-4.5 items-center justify-center rounded text-[10px] font-medium ${
                opacity === o
                  ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                  : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
              }`}
              title={`${o}%`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
