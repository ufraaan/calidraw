import { useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

const swatches = [
  '#2d2d2d', '#e8847a', '#74aed8', '#81c4a1', '#cc99c8',
]

function cssVar(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

interface ColorPickerProps {
  label: 'stroke' | 'fill'
  color: string
  strokeWidth: number
  opacity: number
  bowing: number
  onColorChange: (color: string) => void
  onStrokeWidthChange: (width: number) => void
  onOpacityChange: (opacity: number) => void
  onBowingChange: (bowing: number) => void
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
    ctx.strokeStyle = active ? cssVar('--accent', '#e8a07a') : cssVar('--ink-faint', '#a1a1aa')
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(3, 4)
    ctx.lineTo(15, 4)
    ctx.stroke()
  }, [width, active])
  return <canvas ref={ref} className="block" style={{ width: 18, height: 8 }} />
}

/** Tiny canvas that draws a wavy line showing a bowing level. */
function BowingPreview({ bowing, active }: { bowing: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = 2
    c.width = 18 * dpr
    c.height = 10 * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, 18, 10)
    ctx.strokeStyle = active ? cssVar('--accent', '#e8a07a') : cssVar('--ink-faint', '#a1a1aa')
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    ctx.beginPath()
    const amp = bowing * 0.6 // wave amplitude scales with bowing
    for (let x = 2; x <= 16; x += 0.5) {
      const y = 5 + Math.sin((x - 2) * 1.2) * amp
      if (x === 2) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }, [bowing, active])
  return <canvas ref={ref} className="block" style={{ width: 18, height: 10 }} />
}

export function ColorPicker({
  label,
  color,
  strokeWidth,
  opacity,
  bowing,
  onColorChange,
  onStrokeWidthChange,
  onOpacityChange,
  onBowingChange,
}: ColorPickerProps): ReactNode {
  const showDetails = label === 'stroke'

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={color === 'transparent' ? '#ffffff' : color}
        aria-label={label === 'stroke' ? 'Stroke color' : 'Fill color'}
        onChange={(e) => onColorChange(e.target.value)}
        className="size-4 cursor-pointer rounded border border-black/10 bg-transparent p-0"
        style={{ borderColor: 'var(--hairline)' }}
        title={label === 'stroke' ? 'Stroke color' : 'Fill color'}
      />
      <div className="flex items-center gap-1">
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={color === c}
            onClick={() => onColorChange(c)}
            className="ui-iconbtn ui-swatch size-4 min-h-4 min-w-4"
            style={color === c ? { outline: '2px solid var(--accent)', outlineOffset: '1px', backgroundColor: c } : { backgroundColor: c }}
          />
        ))}
        {label === 'fill' && (
          <button
            type="button"
            aria-label="No fill"
            aria-pressed={color === 'transparent'}
            onClick={() => onColorChange('transparent')}
            className="ui-iconbtn ui-swatch size-4 min-h-4 min-w-4 text-[8px] font-bold leading-none"
            style={color === 'transparent' ? { outline: '2px solid var(--accent)', outlineOffset: '1px' } : undefined}
            title="No fill"
          >
            /
          </button>
        )}
      </div>
      {showDetails && (
        <>
          {/* ── Stroke width (visual previews) ─────────────── */}
          <div className="ui-div w-px self-stretch" />
          <div className="flex items-center gap-0.5" role="group" aria-label="Stroke width">
            {[1, 2, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onStrokeWidthChange(w)}
                aria-label={`${w} pixels`}
                aria-pressed={strokeWidth === w}
                className={`ui-iconbtn size-6 min-h-6 min-w-6 ${strokeWidth === w ? 'is-active' : ''}`}
                title={`${w}px stroke`}
              >
                <StrokePreview width={w} active={strokeWidth === w} />
              </button>
            ))}
          </div>

          {/* ── Opacity slider ─────────────────────────────── */}
          <div className="ui-div w-px self-stretch" />
          <div className="flex items-center gap-1.5">
            <label className="ui-faint sr-only" htmlFor={`opacity-${label}`}>Opacity</label>
            <input
              id={`opacity-${label}`}
              type="range"
              min={5}
              max={100}
              step={1}
              value={opacity}
              aria-label="Opacity"
              onChange={(e) => onOpacityChange(Number(e.target.value))}
              className="
                h-1 w-16 cursor-pointer appearance-none rounded-full
                bg-black/10
                accent-[#e8a07a]
                [&::-webkit-slider-thumb]:size-2.5
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-[#e8a07a]
                [&::-webkit-slider-thumb]:shadow-[0_1px_2px_rgba(0,0,0,0.2)]
              "
              style={{ background: 'var(--wash)' }}
              title={`Opacity: ${opacity}%`}
            />
            <span className="ui-faint ui-nums min-w-[2ch]">
              {opacity}%
            </span>
          </div>

          {/* ── Bowing presets ────────────────────────────── */}
          <div className="ui-div w-px self-stretch" />
          <div className="flex items-center gap-0.5" role="group" aria-label="Bowing">
            {[
              { value: 0, label: 'off' },
              { value: 1, label: 'natural' },
              { value: 3, label: 'wavy' },
              { value: 6, label: 'loose' },
            ].map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => onBowingChange(b.value)}
                aria-pressed={bowing === b.value}
                className={`ui-iconbtn flex-col gap-[1px] px-1.5 py-0.5 text-[8px] font-medium leading-none ${bowing === b.value ? 'is-active' : ''}`}
                title={`Bowing: ${b.label}`}
              >
                <BowingPreview bowing={b.value} active={bowing === b.value} />
                <span className="ui-faint">{b.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
