import { memo } from 'react'
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

export const ZoomControl = memo(function ZoomControl({ onFit, onFitSelection }: { onFit: () => void; onFitSelection: () => void }): ReactNode {
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  const saveStatus = useSelector(canvasStore, (s) => s.saveStatus)
  const hasSelection = selectedIds.length > 0

  return (
    <div className="ui-panel pointer-events-auto absolute bottom-6 right-6 flex items-center gap-2 px-3 py-2">
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
        <span className="ui-faint ui-nums min-w-[3.2rem]">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      <div className="ui-div h-4 w-px" />

      {/* Element count */}
      {hasSelection && (
        <>
          <span className="ui-faint ui-nums whitespace-nowrap">
            {selectedIds.length} selected
          </span>
          <div className="ui-div h-4 w-px" />
        </>
      )}

      {/* Zoom out */}
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => animateZoom(zoom - 0.1)}
        className="ui-iconbtn size-6 min-h-6 min-w-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Zoom percentage + presets */}
      <label className="ui-faint sr-only" htmlFor="zoom-preset">Zoom level</label>
      <select
        id="zoom-preset"
        aria-label="Zoom level presets"
        value={Math.round(zoom * 100)}
        onChange={(e) => animateZoom(Number(e.target.value) / 100)}
        className="ui-select ui-nums"
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
        className="ui-iconbtn size-6 min-h-6 min-w-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      </button>

      <div className="ui-div h-4 w-px" />

      {/* Fit / selection */}
      <button
        type="button"
        title="Zoom to fit (Shift+1)"
        onClick={onFit}
        className="ui-btn"
      >
        Fit
      </button>
      {hasSelection && (
        <button
          type="button"
          title="Zoom to selection (Shift+2)"
          onClick={onFitSelection}
          className="ui-btn"
        >
          Sel
        </button>
      )}

      {/* Reset */}
      <button
        type="button"
        title="Reset zoom to 100%"
        onClick={() => animateZoom(1)}
        className="ui-btn"
      >
        Reset
      </button>
    </div>
  )
})
