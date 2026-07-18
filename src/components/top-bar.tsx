import { useSelector } from '@tanstack/react-store'
import { canvasStore, setZoom } from '../stores/canvas-store'
import { Panel } from './ui/panel'
import { VSeparator } from './ui/separator'
import { IconZoomIn, IconZoomOut } from './ui/icons'
import type { ReactNode } from 'react'

export function TopBar(): ReactNode {
  const zoom = useSelector(canvasStore, (s) => s.zoom)

  return (
    <Panel className="pointer-events-auto absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1">
      <span className="px-1 text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">
        Calidraw
      </span>
      <VSeparator />
      <button
        type="button"
        onClick={() => setZoom(Math.max(0.1, zoom - 0.1))}
        className="flex size-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        title="Zoom out"
      >
        <IconZoomOut />
      </button>
      <span className="min-w-[3rem] text-center text-xs font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={() => setZoom(Math.min(5, zoom + 0.1))}
        className="flex size-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        title="Zoom in"
      >
        <IconZoomIn />
      </button>
      <button
        type="button"
        onClick={() => setZoom(1)}
        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        Reset
      </button>
    </Panel>
  )
}
