import { createStore } from '@tanstack/react-store'
import type { Tool } from '../types'

export type SaveStatus = 'idle' | 'saving' | 'saved'

export const DEFAULT_LIGHT = '#1e1e1e'
export const DEFAULT_DARK = '#e4e4e7'

export interface CanvasState {
  tool: Tool
  zoom: number
  offsetX: number
  offsetY: number
  strokeColor: string
  backgroundColor: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed' | 'dotted'
  opacity: number
  roughness: number
  selectedIds: string[]
  saveStatus: SaveStatus
}

const POV_KEY = 'calidraw-pov'

function loadPOV(): { zoom: number; offsetX: number; offsetY: number } | null {
  try {
    const raw = localStorage.getItem(POV_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return null
}

const saved = loadPOV()

function detectDarkMode(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch {
    return false
  }
}

const initialState: CanvasState = {
  tool: 'select',
  zoom: saved?.zoom ?? 1,
  offsetX: saved?.offsetX ?? 0,
  offsetY: saved?.offsetY ?? 0,
  strokeColor: detectDarkMode() ? DEFAULT_DARK : DEFAULT_LIGHT,
  backgroundColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  roughness: 1,
  selectedIds: [],
  saveStatus: 'idle',
}

export const canvasStore = createStore(initialState)

function savePOV() {
  const s = canvasStore.state
  localStorage.setItem(
    POV_KEY,
    JSON.stringify({ zoom: s.zoom, offsetX: s.offsetX, offsetY: s.offsetY }),
  )
}

export function setTool(tool: Tool) {
  canvasStore.setState((s) => ({ ...s, tool }))
}

export function zoomAtPoint(newZoom: number, cx?: number, cy?: number) {
  const s = canvasStore.state
  const px = cx ?? window.innerWidth / 2
  const py = cy ?? window.innerHeight / 2
  const canvasX = (px - s.offsetX) / s.zoom
  const canvasY = (py - s.offsetY) / s.zoom
  canvasStore.setState((prev) => ({
    ...prev,
    zoom: newZoom,
    offsetX: px - canvasX * newZoom,
    offsetY: py - canvasY * newZoom,
  }))
  savePOV()
}

export function setOffset(offsetX: number, offsetY: number) {
  canvasStore.setState((s) => ({ ...s, offsetX, offsetY }))
  savePOV()
}

export function setStrokeColor(color: string) {
  canvasStore.setState((s) => ({ ...s, strokeColor: color }))
}

export function setBackgroundColor(color: string) {
  canvasStore.setState((s) => ({ ...s, backgroundColor: color }))
}

export function setStrokeWidth(width: number) {
  canvasStore.setState((s) => ({ ...s, strokeWidth: width }))
}

export function setOpacity(opacity: number) {
  canvasStore.setState((s) => ({ ...s, opacity }))
}

export function setSelectedIds(ids: string[]) {
  canvasStore.setState((s) => ({ ...s, selectedIds: ids }))
}

// ── Color scheme (dark/light) listener ────────────────────────
type ColorSchemeCallback = (isDark: boolean) => void
let colorSchemeSubscriber: ColorSchemeCallback | null = null
let colorSchemeCleanup: (() => void) | null = null

/**
 * Subscribe to color-scheme changes. Returns unsubscribe.
 * The callback fires on each change; the store's `strokeColor` is
 * also updated automatically to the appropriate default.
 */
export function subscribeColorScheme(cb: ColorSchemeCallback): () => void {
  colorSchemeSubscriber = cb
  return () => {
    colorSchemeSubscriber = null
  }
}

/** Start listening for `prefers-color-scheme` changes. Call once on mount. */
export function startColorSchemeListener(): () => void {
  if (colorSchemeCleanup) return colorSchemeCleanup // already started

  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e: MediaQueryListEvent) => {
    const isDark = e.matches
    canvasStore.setState((s) => ({
      ...s,
      strokeColor: isDark ? DEFAULT_DARK : DEFAULT_LIGHT,
    }))
    colorSchemeSubscriber?.(isDark)
  }
  mq.addEventListener('change', handler)
  colorSchemeCleanup = () => mq.removeEventListener('change', handler)
  return colorSchemeCleanup
}

// ── Smooth zoom animation ────────────────────────────────────
let zoomAnimation: number | null = null

export function animateZoom(targetZoom: number, cx?: number, cy?: number) {
  const startZoom = canvasStore.state.zoom
  const clampedTarget = Math.max(0.1, Math.min(5, targetZoom))
  const startTime = performance.now()
  const duration = 150

  if (zoomAnimation) cancelAnimationFrame(zoomAnimation)

  function animate(time: number) {
    const t = Math.min((time - startTime) / duration, 1)
    const ease = 1 - Math.pow(1 - t, 3) // ease-out cubic
    const currentZoom = startZoom + (clampedTarget - startZoom) * ease
    zoomAtPoint(currentZoom, cx, cy)

    if (t < 1) {
      zoomAnimation = requestAnimationFrame(animate)
    } else {
      zoomAnimation = null
    }
  }

  zoomAnimation = requestAnimationFrame(animate)
}

// ── Auto-save indicator ──────────────────────────────────────
let saveTimeout: ReturnType<typeof setTimeout> | null = null

export function triggerSaveStatus() {
  canvasStore.setState((s) => ({ ...s, saveStatus: 'saving' as SaveStatus }))
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    canvasStore.setState((s) => ({ ...s, saveStatus: 'saved' as SaveStatus }))
    setTimeout(() => {
      canvasStore.setState((s) => ({ ...s, saveStatus: 'idle' as SaveStatus }))
    }, 1200)
  }, 300)
}
