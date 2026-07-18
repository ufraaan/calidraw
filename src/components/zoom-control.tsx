import { useSelector } from '@tanstack/react-store'
import { canvasStore, animateZoom } from '../stores/canvas-store'
import type { ReactNode } from 'react'

export function ZoomControl(): ReactNode {
  const zoom = useSelector(canvasStore, (s) => s.zoom)
  const selectedIds = useSelector(canvasStore, (s) => s.selectedIds)
  const saveStatus = useSelector(canvasStore, (s) => s.saveStatus)
  const hasSelection = selectedIds.length > 0

  const glass =
    'bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900/70 dark:border-white/[0.06] dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]'

  return (
    <div className={`pointer-events-auto absolute bottom-6 right-6 flex items-center rounded-lg ${glass} px-3 py-1.5 gap-2`}>
      {/* Auto-save indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={`size-1.5 rounded-full transition-colors duration-300 ${
            saveStatus === 'saving'
              ? 'bg-amber-400'
              : saveStatus === 'saved'
                ? 'bg-emerald-400'
                : 'bg-zinc-300 dark:bg-zinc-600'
          }`}
        />
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
      </div>

      {/* Divider */}
      {saveStatus !== 'idle' && hasSelection && (
        <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />
      )}

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
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Zoom percentage */}
      <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums tracking-tight text-zinc-500 dark:text-zinc-400">
        {Math.round(zoom * 100)}%
      </span>

      {/* Zoom in */}
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => animateZoom(zoom + 0.1)}
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-black/[0.06] dark:bg-white/[0.06]" />

      {/* Reset */}
      <button
        type="button"
        onClick={() => animateZoom(1)}
        className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        Reset
      </button>
    </div>
  )
}
