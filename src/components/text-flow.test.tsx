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

describe('text tool flow', () => {
  it('clicking empty canvas opens a visible editor', async () => {
    const stage = await setupTextTool()
    fireEvent.pointerDown(stage, { button: 0, clientX: 150, clientY: 120, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 150, clientY: 120 })
    const editor = screen.getByRole('textbox')
    expect(editor).toBeTruthy()
    expect(document.activeElement).toBe(editor)
  })

  it('typing then pressing enter commits, double-click reopens with content', async () => {
    const stage = await setupTextTool()
    fireEvent.pointerDown(stage, { button: 0, clientX: 150, clientY: 120, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 150, clientY: 120 })
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'hello' } })
    expect(editor.value).toBe('hello')
    fireEvent.keyDown(editor, { key: 'Enter', shiftKey: false })

    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.doubleClick(stage, { button: 0, clientX: 152, clientY: 122 })
    const reopened = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(reopened.value).toBe('hello')
  })

  it('clicking away commits instead of losing the text', async () => {    const stage = await setupTextTool()
    fireEvent.pointerDown(stage, { button: 0, clientX: 150, clientY: 120, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 150, clientY: 120 })
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.change(editor, { target: { value: 'away' } })

    fireEvent.pointerDown(stage, { button: 0, clientX: 400, clientY: 400, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 400, clientY: 400 })
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.doubleClick(stage, { button: 0, clientX: 152, clientY: 122 })
    const reopened = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(reopened.value).toBe('away')
  })

  it('theme toggle flips the dark class on <html>', async () => {
    await setupTextTool()
    const { canvasStore, setTheme } = await import('../stores/canvas-store')
    act(() => {
      setTheme(true)
    })
    expect(canvasStore.state.isDark).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('calidraw-theme')).toBe('dark')
    act(() => {
      setTheme(false)
    })
    expect(canvasStore.state.isDark).toBe(false)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('c and 4 select the ellipse tool', async () => {
    await setupTextTool()
    const { canvasStore } = await import('../stores/canvas-store')
    act(() => {
      fireEvent.keyDown(window, { key: 'c' })
    })
    expect(canvasStore.state.tool).toBe('ellipse')
    act(() => {
      fireEvent.keyDown(window, { key: 'v' })
    })
    expect(canvasStore.state.tool).toBe('select')
    act(() => {
      fireEvent.keyDown(window, { key: '4' })
    })
    expect(canvasStore.state.tool).toBe('ellipse')
  })

  it('typing letters while editing never switches tools', async () => {
    const stage = await setupTextTool()
    const { canvasStore } = await import('../stores/canvas-store')
    fireEvent.pointerDown(stage, { button: 0, clientX: 150, clientY: 120, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 150, clientY: 120 })
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(document.activeElement).toBe(editor)
    act(() => {
      fireEvent.keyDown(editor, { key: 'a' })
    })
    expect(canvasStore.state.tool).toBe('text')
    expect(screen.getByRole('textbox')).toBeTruthy()
    act(() => {
      fireEvent.keyDown(window, { key: 'a' })
    })
    expect(canvasStore.state.tool).toBe('text')
    expect(screen.getByRole('textbox')).toBeTruthy()
    fireEvent.change(editor, { target: { value: 'a' } })
    expect(editor.value).toBe('a')
  })

  it('blurring to the canvas does not cancel an empty editor', async () => {
    const stage = await setupTextTool()
    fireEvent.pointerDown(stage, { button: 0, clientX: 150, clientY: 120, detail: 1 })
    fireEvent.pointerUp(stage, { button: 0, clientX: 150, clientY: 120 })
    const editor = screen.getByRole('textbox') as HTMLTextAreaElement
    fireEvent.blur(editor, { relatedTarget: stage })
    expect(screen.getByRole('textbox')).toBeTruthy()
    expect((await import('../stores/canvas-store')).canvasStore.state.tool).toBe('text')
  })

  it('bare keystrokes still switch tools when not editing', async () => {
    await setupTextTool()
    const { canvasStore } = await import('../stores/canvas-store')
    act(() => {
      fireEvent.keyDown(window, { key: 'a' })
    })
    expect(canvasStore.state.tool).toBe('arrow')
  })

  it('ctrl+v never preventDefaults so native image paste can fire', async () => {
    await setupTextTool()
    const { copyToClipboard } = await import('../hooks/use-keyboard')
    act(() => {
      copyToClipboard([])
    })
    const notCanceled = fireEvent.keyDown(window, { key: 'v', ctrlKey: true })
    expect(notCanceled).toBe(true)
    const rect = {
      id: 'r1',
      type: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      angle: 0,
      strokeColor: '#000',
      backgroundColor: 'transparent',
      strokeWidth: 1,
      strokeStyle: 'solid' as const,
      roughness: 1,
      bowing: 1,
      opacity: 100,
    }
    act(() => {
      copyToClipboard([rect])
    })
    expect(fireEvent.keyDown(window, { key: 'v', ctrlKey: true })).toBe(true)
  })
})
