import type { Element, Point, Tool } from '../types'
import { generateId } from './geometry'
import { canvasStore } from '../stores/canvas-store'

interface DrawState {
  startPoint: Point | null
  currentPoint: Point | null
  points: Point[]
  isDrawing: boolean
}

let drawState: DrawState = {
  startPoint: null,
  currentPoint: null,
  points: [],
  isDrawing: false,
}

export function startDrawing(point: Point): void {
  drawState = {
    startPoint: { ...point },
    currentPoint: { ...point },
    points: [point],
    isDrawing: true,
  }
}

export function updateDrawing(point: Point): Partial<Element> | null {
  if (!drawState.isDrawing || !drawState.startPoint) return null
  drawState.currentPoint = { ...point }

  const state = canvasStore.state
  const { startPoint, currentPoint } = drawState

  if (state.tool === 'pencil') {
    // Only add a point if it's far enough from the last one.
    // This eliminates micro-jitter while preserving the overall shape.
    const last = drawState.points[drawState.points.length - 1]
    if (last) {
      const dx = point.x - last.x
      const dy = point.y - last.y
      if (dx * dx + dy * dy >= 4) {
        drawState.points.push(point)
      }
    }
    // Always include the live cursor position in the preview
    // so the stroke doesn't visually lag behind the mouse.
    const previewPoints = [...drawState.points, point]
    return {
      type: 'pencil',
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      roughness: state.roughness,
      bowing: state.bowing,
      opacity: state.opacity,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: previewPoints,
    }
  }

  const base: Partial<Element> = {
    strokeColor: state.strokeColor,
    backgroundColor: state.backgroundColor,
    strokeWidth: state.strokeWidth,
    strokeStyle: state.strokeStyle,
    opacity: state.opacity,
    roughness: state.roughness,
    bowing: state.bowing,
  }

  switch (state.tool) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse':
      return {
        ...base,
        type: state.tool,
        x: startPoint.x,
        y: startPoint.y,
        width: currentPoint.x - startPoint.x,
        height: currentPoint.y - startPoint.y,
      }
    case 'arrow':
    case 'line':
      return {
        ...base,
        type: state.tool,
        x: startPoint.x,
        y: startPoint.y,
        width: currentPoint.x - startPoint.x,
        height: currentPoint.y - startPoint.y,
        points: [{ ...startPoint }, { ...currentPoint }],
      }
    default:
      return null
  }
}

export function endDrawing(): Element | null {
  if (!drawState.isDrawing || !drawState.startPoint) return null

  const state = canvasStore.state
  const { startPoint, currentPoint } = drawState

  const base = {
    id: generateId(),
    angle: 0,
    strokeColor: state.strokeColor,
    backgroundColor: state.backgroundColor,
    strokeWidth: state.strokeWidth,
    strokeStyle: state.strokeStyle,
    opacity: state.opacity,
    roughness: state.roughness,
    bowing: state.bowing,
  }

  let element: Element

  switch (state.tool) {
    case 'rectangle':
    case 'diamond':
    case 'ellipse': {
      element = {
        ...base,
        type: state.tool,
        x: startPoint.x,
        y: startPoint.y,
        width: currentPoint ? currentPoint.x - startPoint.x : 0,
        height: currentPoint ? currentPoint.y - startPoint.y : 0,
      }
      break
    }
    case 'arrow':
    case 'line': {
      element = {
        ...base,
        type: state.tool,
        x: startPoint.x,
        y: startPoint.y,
        width: currentPoint ? currentPoint.x - startPoint.x : 0,
        height: currentPoint ? currentPoint.y - startPoint.y : 0,
        ...(state.tool === 'line' && {
          points: [{ ...startPoint }, { ...(currentPoint ?? startPoint) }],
        }),
      }
      break
    }
    case 'pencil': {
      const pts = [...drawState.points]
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of pts) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      element = {
        ...base,
        type: 'pencil',
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        points: pts,
      }
      break
    }
    default:
      drawState = { startPoint: null, currentPoint: null, points: [], isDrawing: false }
      return null
  }

  drawState = { startPoint: null, currentPoint: null, points: [], isDrawing: false }
  return element
}

export function isShapeTool(tool: Tool): boolean {
  return ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'pencil', 'laser'].includes(tool)
}
