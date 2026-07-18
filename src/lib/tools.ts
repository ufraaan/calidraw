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
    drawState.points.push(point)
    return {
      type: 'pencil',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      points: [...drawState.points],
    }
  }

  const base: Partial<Element> = {
    strokeColor: state.strokeColor,
    backgroundColor: state.backgroundColor,
    strokeWidth: state.strokeWidth,
    strokeStyle: state.strokeStyle,
    opacity: state.opacity,
    roughness: state.roughness,
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
      element = {
        ...base,
        type: 'pencil',
        x: startPoint.x,
        y: startPoint.y,
        width: 0,
        height: 0,
        points: [...drawState.points],
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
  return ['rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'pencil'].includes(tool)
}
