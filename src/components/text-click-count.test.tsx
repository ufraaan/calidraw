// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

async function resetStore() {
  const { canvasStore, setEditingTextId, setTool } = await import('../stores/canvas-store')
  const { act } = await import('@testing-library/react')
  act(() => {
    setEditingTextId(null)
    setTool('select')
    canvasStore.setState((s) => ({ ...s, selectedIds: [] }))
  })
}

vi.mock('../lib/renderer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/renderer')>()
  return { ...mod, renderScene: vi.fn() }
})

function fake2d(canvas: HTMLCanvasElement): unknown {
  return new Proxy(
    { canvas },
    {
      get(_target, p) {
        if (p === 'canvas') return canvas
        if (p === 'measureText') return () => ({ width: 42 })
        if (p === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })
        return () => undefined
      },
      set() {
        return true
      },
    },
  )
}

beforeAll(() => {
  const fake = function (this: HTMLCanvasElement) {
    return fake2d(this) as unknown as CanvasRenderingContext2D
  }
  HTMLCanvasElement.prototype.getContext =
    fake as unknown as typeof HTMLCanvasElement.prototype.getContext
})

async function setupTextTool() {
  await resetStore()
  const { CanvasView } = await import('./canvas')
  const { setTool } = await import('../stores/canvas-store')
  render(<CanvasView />)
  const stage = screen.getByRole('application')
  act(() => {
    setTool('text')
  })
  return stage as unknown as HTMLElement
}

function click(stage: HTMLElement, x: number, y: number, extra: object = {}) {
  fireEvent.pointerDown(stage, { button: 0, clientX: x, clientY: y, ...extra })
  fireEvent.pointerUp(stage, { button: 0, clientX: x, clientY: y })
}

describe('text tool must not gate on pointerdown click-count', () => {
  it('opens the editor on a real Chrome/Firefox pointerdown (detail defaults to 0)', async () => {
    const stage = await setupTextTool()
    click(stage, 150, 120)
    const editor = screen.getByRole('textbox')
    expect(editor).toBeTruthy()
    expect(document.activeElement).toBe(editor)
  })

  it('opens the editor on a Safari single click (pointerdown detail === 1)', async () => {
    const stage = await setupTextTool()
    click(stage, 150, 120, { detail: 1 })
    expect(screen.getByRole('textbox')).toBeTruthy()
  })

  it('opens the editor even with a residual OS click-count (detail >= 2)', async () => {

    const stage = await setupTextTool()
    click(stage, 150, 120, { detail: 3 })
    const editor = screen.getByRole('textbox')
    expect(editor).toBeTruthy()
    expect(document.activeElement).toBe(editor)
  })

  it('double-click junk placeholders are garbage-collected by dblclick', async () => {
    const stage = await setupTextTool()
    click(stage, 150, 120)
    click(stage, 150, 120)
    fireEvent.doubleClick(stage, { button: 0, clientX: 150, clientY: 120 })
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
