import { createStore } from '@tanstack/react-store'
import type { Tool } from '../types'

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

const initialState: CanvasState = {
  tool: 'select',
  zoom: saved?.zoom ?? 1,
  offsetX: saved?.offsetX ?? 0,
  offsetY: saved?.offsetY ?? 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  roughness: 1,
  selectedIds: [],
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
