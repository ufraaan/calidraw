import { useRef, useEffect } from 'react'
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

/** Tiny canvas that draws a horizontal line at the given stroke width. */
function StrokePreview({ width, active }: { width: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = 2
    c.width = 18 * dpr
    c.height = 8 * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, 18, 8)
    ctx.strokeStyle = active ? '#18181b' : '#a1a1aa'
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(3, 4)
    ctx.lineTo(15, 4)
    ctx.stroke()
  }, [width, active])
  return <canvas ref={ref} className="block" style={{ width: 18, height: 8 }} />
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
          {/* ── Stroke width (visual previews) ─────────────── */}
          <div className="w-px self-stretch bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="flex items-center gap-px">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onStrokeWidthChange(w)}
                className={`flex size-5 items-center justify-center rounded-sm ${
                  strokeWidth === w
                    ? 'bg-black/[0.06] dark:bg-white/[0.08]'
                    : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
                }`}
                title={`${w}px stroke`}
              >
                <StrokePreview width={w} active={strokeWidth === w} />
              </button>
            ))}
          </div>

          {/* ── Opacity slider ─────────────────────────────── */}
          <div className="w-px self-stretch bg-black/[0.06] dark:bg-white/[0.06]" />
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min={5}
              max={100}
              step={1}
              value={opacity}
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="
                h-1 w-16 cursor-pointer appearance-none rounded-full
                bg-black/[0.08] dark:bg-white/[0.1]
                accent-zinc-700 dark:accent-zinc-300
                [&::-webkit-slider-thumb]:size-2.5
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-zinc-700
                [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.2)]
                dark:[&::-webkit-slider-thumb]:bg-zinc-200
              "
              title={`Opacity: ${opacity}%`}
            />
            <span className="min-w-[2ch] text-[10px] font-medium tabular-nums text-zinc-400 dark:text-zinc-500">
              {opacity}%
            </span>
          </div>
        </>
      )}
    </div>
  )
}
