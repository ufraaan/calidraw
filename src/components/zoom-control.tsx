import { useSelector } from '@tanstack/react-store'
import { canvasStore, zoomAtPoint } from '../stores/canvas-store'
import { Panel } from './ui/panel'
import type { ReactNode } from 'react'

export function ZoomControl(): ReactNode {
  const zoom = useSelector(canvasStore, (s) => s.zoom)

  return (
    <Panel className="pointer-events-auto absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5">
      <button
        type="button"
        aria-label="Zoom out"
        onClick={() => zoomAtPoint(Math.max(0.1, zoom - 0.1))}
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>
      <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums tracking-tight text-zinc-500 dark:text-zinc-400">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={() => zoomAtPoint(Math.min(5, zoom + 0.1))}
        className="flex size-6 items-center justify-center rounded text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      </button>
      <div className="w-px h-4 bg-black/[0.06] dark:bg-white/[0.06]" />
      <button
        type="button"
        onClick={() => zoomAtPoint(1)}
        className="text-[11px] font-medium text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        Reset
      </button>
    </Panel>
  )
}
