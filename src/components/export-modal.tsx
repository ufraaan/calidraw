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
  const firstField = useRef<HTMLInputElement>(null)

  const canSelectSelection = selectedIds.length > 0

  useEffect(() => {
    firstField.current?.focus()
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

  return (
    <div className="ui-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export canvas"
        className="ui-pop ui-enter flex w-[300px] flex-col gap-4 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="ui-label">Export</span>

        {/* Filename */}
        <label className="flex flex-col gap-1.5">
          <span className="ui-faint">Filename</span>
          <input
            ref={firstField}
            type="text"
            value={filename}
            aria-label="Export filename"
            onChange={(e) => setFilename(e.target.value)}
            className="ui-input ui-input-lg border"
            style={{ borderColor: 'var(--hairline)' }}
          />
        </label>

        {/* Mode */}
        <div className="flex gap-1.5" role="group" aria-label="Export scope">
          <button type="button" className={`ui-btn flex-1 ${mode === 'all' ? 'is-active' : ''}`} onClick={() => setMode('all')}>
            Entire canvas
          </button>
          <button
            type="button"
            className={`ui-btn flex-1 ${mode === 'selection' ? 'is-active' : ''}`}
            disabled={!canSelectSelection}
            onClick={() => canSelectSelection && setMode('selection')}
          >
            Selection
          </button>
        </div>

        {/* Scale — PNG only */}
        {format === 'png' && (
          <div className="flex gap-1.5" role="group" aria-label="Export scale">
            {[1, 2, 3, 4].map((s) => (
              <button key={s} type="button" className={`ui-btn ui-nums flex-1 ${scale === s ? 'is-active' : ''}`} onClick={() => setScale(s)}>
                {s}×
              </button>
            ))}
          </div>
        )}

        {/* Format */}
        <div className="flex gap-1.5" role="group" aria-label="Export format">
          <button type="button" className={`ui-btn flex-1 ${format === 'png' ? 'is-active' : ''}`} onClick={() => setFormat('png')}>
            PNG
          </button>
          <button type="button" className={`ui-btn flex-1 ${format === 'svg' ? 'is-active' : ''}`} onClick={() => setFormat('svg')}>
            SVG
          </button>
          <button type="button" className={`ui-btn flex-1 ${format === 'json' ? 'is-active' : ''}`} onClick={() => setFormat('json')}>
            JSON
          </button>
        </div>

        <div className="ui-div h-px w-full" />

        {feedback && (
          <span className="text-xs" style={{ color: 'var(--accent)' }} role="status">{feedback}</span>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          <button type="button" onClick={onClose} className="ui-btn flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleCopy} className="ui-btn flex-1">
            Copy
          </button>
          <button type="button" onClick={handleExport} className="ui-btn ui-btn-primary flex-1">
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
