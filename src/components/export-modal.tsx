import { useState } from 'react'
import { downloadAsPNG, downloadAsSVG } from '../lib/renderer'
import type { Element } from '../types'

interface ExportModalProps {
  elements: Element[]
  selectedIds: string[]
  onClose: () => void
}

export function ExportModal({ elements, selectedIds, onClose }: ExportModalProps) {
  const [mode, setMode] = useState<'all' | 'selection'>('all')
  const [scale, setScale] = useState(2)
  const [format, setFormat] = useState<'png' | 'svg'>('png')

  const canSelectSelection = selectedIds.length > 0

  const handleExport = () => {
    const ids = mode === 'selection' ? selectedIds : []
    const label = mode === 'selection' ? 'selection' : 'canvas'

    if (format === 'svg') {
      downloadAsSVG(elements, ids, `calidraw-${label}.svg`)
    } else {
      downloadAsPNG(elements, ids, `calidraw-${label}.png`, scale)
    }
    onClose()
  }

  const btnClass = (active: boolean, disabled = false) =>
    `flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-100 ${
      disabled
        ? 'cursor-default text-zinc-300 dark:text-zinc-600'
        : active
          ? 'bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900'
          : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800'
    }`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/[0.04] dark:bg-black/40" />

      {/* Panel */}
      <div
        className="relative w-[280px] rounded-xl border border-zinc-200/80 bg-white p-5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.25)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="mb-5 text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
          Export
        </div>

        {/* Mode */}
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Export
        </div>
        <div className="mb-4 flex gap-1.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            type="button"
            className={btnClass(mode === 'all')}
            onClick={() => setMode('all')}
          >
            Entire canvas
          </button>
          <button
            type="button"
            className={btnClass(mode === 'selection', !canSelectSelection)}
            disabled={!canSelectSelection}
            onClick={() => canSelectSelection && setMode('selection')}
          >
            Selection
          </button>
        </div>

        {/* Scale (PNG only) */}
        {format === 'png' && (
          <>
            <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Scale
            </div>
            <div className="mb-4 flex gap-1.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={btnClass(scale === s)}
                  onClick={() => setScale(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </>
        )}

        {/* Format */}
        <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Format
        </div>
        <div className="mb-5 flex gap-1.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            type="button"
            className={btnClass(format === 'png')}
            onClick={() => setFormat('png')}
          >
            PNG
          </button>
          <button
            type="button"
            className={btnClass(format === 'svg')}
            onClick={() => setFormat('svg')}
          >
            SVG
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-all duration-100 hover:bg-zinc-800 active:scale-[0.97] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
