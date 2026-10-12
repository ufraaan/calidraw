import { useSelector } from '@tanstack/react-store'
import { canvasStore, animateZoom, setOffset } from '../stores/canvas-store'
import { getNormalizedBounds } from '../lib/geometry'
import type { Element } from '../types'
import type { ReactNode } from 'react'

export function zoomToFit(elements: Element[]) {
  if (elements.length === 0) {
    animateZoom(1)
    return
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of elements) {
    const b = getNormalizedBounds(el)
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.w > maxX) maxX = b.x + b.w
    if (b.y + b.h > maxY) maxY = b.y + b.h
  }
  const pad = 40
  const vw = window.innerWidth - pad * 2
  const vh = window.innerHeight - pad * 2
  const zw = vw / Math.max(maxX - minX, 1)
  const zh = vh / Math.max(maxY - minY, 1)
  const zoom = Math.max(0.1, Math.min(5, Math.min(zw, zh)))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  setOffset(window.innerWidth / 2 - cx * zoom, window.innerHeight / 2 - cy * zoom)
  animateZoom(zoom, window.innerWidth / 2, window.innerHeight / 2)
}

export function ZoomControl({ elements }: { elements: Element[] }): ReactNode {
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  const saveStatus = useSelector(canvasStore, (s) => s.saveStatus)
  const hasSelection = selectedIds.length > 0

  const glass =
    'bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900/70 dark:border-white/[0.06] dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]'

  const zoomSelection = () => {
    const sel = elements.filter((e) => selectedIds.includes(e.id))
    if (sel.length > 0) zoomToFit(sel)
  }

  return (
    <div className={`pointer-events-auto absolute bottom-6 right-6 flex items-center rounded-lg ${glass} px-3 py-1.5 gap-2`}>
      {/* Auto-save indicator (separate concern, always rendered for layout stability) */}
      <div className="flex items-center gap-1.5" aria-live="polite">
        <div
          className={`size-1.5 rounded-full transition-colors duration-300 ${
            saveStatus === 'saving'
              ? 'bg-amber-400'
              : saveStatus === 'saved'
                ? 'bg-emerald-400'
                : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        />
        <span className="min-w-[3.2rem] text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Element count */}
      {hasSelection && (
        <>
          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />
        </>
      )}

      {/* Zoom out */}
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => animateZoom(zoom - 0.1)}
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Zoom percentage + presets */}
      <label className="sr-only" htmlFor="zoom-preset">Zoom level</label>
      <select
        id="zoom-preset"
        aria-label="Zoom level presets"
        value={Math.round(zoom * 100)}
        onChange={(e) => animateZoom(Number(e.target.value) / 100)}
        className="min-w-[3.5rem] rounded bg-transparent text-center text-xs font-medium tabular-nums tracking-tight text-zinc-500 dark:text-zinc-400"
      >
        {[25, 50, 75, 100, 150, 200].map((p) => (
          <option key={p} value={p}>{p}%</option>
        ))}
        {![25, 50, 75, 100, 150, 200].includes(Math.round(zoom * 100)) && (
          <option value={Math.round(zoom * 100)}>{Math.round(zoom * 100)}%</option>
        )}
      </select>

      {/* Zoom in */}
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => animateZoom(zoom + 0.1)}
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:bg-[#e8a07a]/10 hover:text-[#e8a07a] dark:hover:bg-[#e8a07a]/15 dark:hover:text-[#e8a07a]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      </button>

      <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Fit / selection */}
      <button
        type="button"
        title="Zoom to fit (Shift+1)"
        onClick={() => zoomToFit(elements)}
        className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-[#e8a07a] dark:hover:text-[#e8a07a]"
      >
        Fit
      </button>
      {hasSelection && (
        <button
          type="button"
          title="Zoom to selection (Shift+2)"
          onClick={zoomSelection}
          className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-[#e8a07a] dark:hover:text-[#e8a07a]"
        >
          Sel
        </button>
      )}

      {/* Reset */}
      <button
        type="button"
        title="Reset zoom to 100%"
        onClick={() => animateZoom(1)}
        className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-[#e8a07a] dark:hover:text-[#e8a07a]"
      >
        Reset
      </button>
    </div>
  )
}
