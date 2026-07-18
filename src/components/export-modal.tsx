import { useState } from 'react'
import { downloadAsPNG } from '../lib/renderer'
import type { Element } from '../types'

interface ExportModalProps {
  elements: Element[]
  selectedIds: string[]
  onClose: () => void
}

export function ExportModal({ elements, selectedIds, onClose }: ExportModalProps) {
  const [mode, setMode] = useState<'all' | 'selection'>('all')
  const [scale, setScale] = useState(2)

  const canSelectSelection = selectedIds.length > 0

  const handleExport = () => {
    const ids = mode === 'selection' ? selectedIds : []
    const label = mode === 'selection' ? 'selection' : 'canvas'
    downloadAsPNG(elements, ids, `calidraw-${label}-${Date.now()}.png`, scale)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[300px] rounded-xl border border-zinc-200 bg-white p-5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.2)] dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          Export
        </h2>

        {/* Mode */}
        <label className="mb-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Export
        </label>
        <div className="mb-4 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'all'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            }`}
            onClick={() => setMode('all')}
          >
            Entire Canvas
          </button>
          <button
            type="button"
            disabled={!canSelectSelection}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
              mode === 'selection'
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : canSelectSelection
                  ? 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  : 'cursor-default bg-zinc-50 text-zinc-300 dark:bg-zinc-800/50 dark:text-zinc-600'
            }`}
            onClick={() => canSelectSelection && setMode('selection')}
          >
            Selection
          </button>
        </div>

        {/* Scale */}
        <label className="mb-3 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Scale
        </label>
        <div className="mb-5 flex gap-2">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              type="button"
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                scale === s
                  ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
              }`}
              onClick={() => setScale(s)}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Export PNG
          </button>
        </div>
      </div>
    </div>
  )
}
