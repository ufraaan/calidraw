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

const initialState: CanvasState = {
  tool: 'select',
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 100,
  roughness: 1,
  selectedIds: [],
}

export const canvasStore = createStore(initialState)

export function setTool(tool: Tool) {
  canvasStore.setState((s) => ({ ...s, tool }))
}

export function setZoom(zoom: number) {
  canvasStore.setState((s) => ({ ...s, zoom }))
}

export function setOffset(offsetX: number, offsetY: number) {
  canvasStore.setState((s) => ({ ...s, offsetX, offsetY }))
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
