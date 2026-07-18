import type { ReactNode } from 'react'

const swatches = [
  '#2d2d2d', '#e8847a', '#74aed8', '#81c4a1', '#cc99c8',
]

interface ColorPickerProps {
  label: 'stroke' | 'fill'
  color: string
  strokeWidth: number
  opacity: number
  onColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onOpacityChange: (opacity: number) => void
}

export function ColorPicker({
  label,
  color,
  strokeWidth,
  opacity,
  onColorChange,
  onStrokeWidthChange,
  onOpacityChange,
}: ColorPickerProps): ReactNode {
  // For stroke, show the native picker + swatches + stroke width + opacity
  // For fill, show the native picker + swatches (+ no-fill button)
  const showDetails = label === 'stroke'

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={color === 'transparent' ? '#ffffff' : color}
        onChange={(e) => onColorChange(e.target.value)}
        className="size-4 cursor-pointer rounded border border-black/[0.06] bg-transparent p-0 dark:border-white/[0.06]"
        title={label === 'stroke' ? 'Stroke color' : 'Fill color'}
      />
      <div className="flex items-center gap-px">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onColorChange(c)}
            className={`size-3 rounded-sm transition-transform hover:scale-110 ${
              color === c
                ? 'ring-1 ring-black/30 dark:ring-white/40 ring-offset-[0.5px] ring-offset-transparent'
                : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {label === 'fill' && (
          <button
            type="button"
            aria-label="No fill"
            onClick={() => onColorChange('transparent')}
            className={`flex size-3 items-center justify-center rounded-sm border border-black/[0.08] text-[6px] font-bold leading-none text-zinc-300 dark:border-white/[0.12] dark:text-zinc-600 ${
              color === 'transparent' ? 'ring-1 ring-black/30 dark:ring-white/40 ring-offset-[0.5px]' : ''
            }`}
          >
            /
          </button>
        )}
      </div>
      {showDetails && (
        <>
          <div className="w-px self-stretch bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="flex items-center gap-px">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onStrokeWidthChange(w)}
                className={`flex size-4 items-center justify-center rounded-sm text-[9px] font-medium leading-none ${
                  strokeWidth === w
                    ? 'bg-black/[0.06] text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
                title={`${w}px`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="w-px self-stretch bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="flex items-center gap-px">
            {[60, 80, 100].map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => onOpacityChange(o)}
                className={`flex size-4 items-center justify-center rounded-sm text-[9px] font-medium leading-none ${
                  opacity === o
                    ? 'bg-black/[0.06] text-zinc-700 dark:bg-white/[0.08] dark:text-zinc-200'
                    : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
                title={`${o}%`}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
