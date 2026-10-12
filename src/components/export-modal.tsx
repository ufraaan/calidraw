import { useState, useEffect, useRef } from 'react'
import {
  downloadAsPNG,
  downloadAsSVG,
  copyToClipboardAsPNG,
  copyToClipboardAsSVG,
  downloadSceneJSON,
} from '../lib/renderer'
import type { Element } from '../types'

interface ExportModalProps {
  elements: Element[]
  selectedIds: string[]
  onClose: () => void
}

export function ExportModal({ elements, selectedIds, onClose }: ExportModalProps) {
  const [mode, setMode] = useState<'all' | 'selection'>('all')
  const [scale, setScale] = useState(2)
  const [format, setFormat] = useState<'png' | 'svg' | 'json'>('png')
  const [filename, setFilename] = useState('calidraw-canvas')
  const [feedback, setFeedback] = useState('')
  const firstBtn = useRef<HTMLButtonElement>(null)

  const canSelectSelection = selectedIds.length > 0

  useEffect(() => {
    firstBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const ids = mode === 'selection' ? selectedIds : []

  const handleExport = () => {
    const name = filename.trim() || 'calidraw-canvas'
    if (format === 'svg') {
      downloadAsSVG(elements, ids, `${name}.svg`)
    } else if (format === 'json') {
      const toSave = ids.length > 0 ? elements.filter((e) => ids.includes(e.id)) : elements
      downloadSceneJSON(toSave, `${name}.json`)
    } else {
      downloadAsPNG(elements, ids, `${name}.png`, scale)
    }
    setFeedback('Exported')
    setTimeout(onClose, 400)
  }

  const handleCopy = async () => {
    try {
      if (format === 'svg') {
        await copyToClipboardAsSVG(elements, ids)
      } else if (format === 'json') {
        const toSave = ids.length > 0 ? elements.filter((e) => ids.includes(e.id)) : elements
        await navigator.clipboard.writeText(JSON.stringify({ type: 'calidraw-scene', version: 1, elements: toSave }))
      } else {
        await copyToClipboardAsPNG(elements, ids)
      }
      setFeedback('Copied to clipboard')
    } catch {
      setFeedback('Copy failed')
    }
  }

  const glass = 'bg-white/70 backdrop-blur-xl border border-black/[0.04] shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900/70 dark:border-white/[0.06] dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)]'

  const btn = (active: boolean, disabled = false) =>
    `flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-100 active:scale-95 ${
      disabled
        ? 'cursor-default text-zinc-300 dark:text-zinc-600'
        : active
          ? 'bg-[#e8a07a]/10 text-[#e8a07a] dark:bg-[#e8a07a]/15 dark:text-[#e8a07a]'
          : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
    }`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export canvas"
        className={`flex flex-col gap-3 rounded-lg ${glass} px-3 py-3 w-[280px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          Export
        </span>

        {/* Filename */}
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-400">Filename</span>
          <input
            ref={firstBtn as never}
            type="text"
            value={filename}
            aria-label="Export filename"
            onChange={(e) => setFilename(e.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs text-zinc-700 dark:border-white/10 dark:text-zinc-200"
          />
        </label>

        {/* Mode */}
        <div className="flex gap-1.5">
          <button type="button" className={btn(mode === 'all')} onClick={() => setMode('all')}>
            Entire canvas
          </button>
          <button
            type="button"
            className={btn(mode === 'selection', !canSelectSelection)}
            disabled={!canSelectSelection}
            onClick={() => canSelectSelection && setMode('selection')}
          >
            Selection
          </button>
        </div>

        {/* Scale — PNG only */}
        {format === 'png' && (
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <button key={s} type="button" className={btn(scale === s)} onClick={() => setScale(s)}>
                {s}×
              </button>
            ))}
          </div>
        )}

        {/* Format */}
        <div className="flex gap-1.5">
          <button type="button" className={btn(format === 'png')} onClick={() => setFormat('png')}>
            PNG
          </button>
          <button type="button" className={btn(format === 'svg')} onClick={() => setFormat('svg')}>
            SVG
          </button>
          <button type="button" className={btn(format === 'json')} onClick={() => setFormat('json')}>
            JSON
          </button>
        </div>

        <div className="w-full h-px bg-black/[0.06] dark:bg-white/[0.06]" />

        {feedback && (
          <span className="text-[11px] text-emerald-500" role="status">{feedback}</span>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-100 hover:text-zinc-700 active:scale-95 dark:text-zinc-500 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-all duration-100 hover:text-zinc-700 active:scale-95 dark:text-zinc-500 dark:hover:text-zinc-200"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 rounded-md bg-[#e8a07a]/15 px-2.5 py-1.5 text-xs font-medium text-[#e8a07a] transition-all duration-100 active:scale-95"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
