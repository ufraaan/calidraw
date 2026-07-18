export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pencil'
  | 'text'

export interface Point {
  x: number
  y: number
}

export interface Element {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  angle: number
  strokeColor: string
  backgroundColor: string
  strokeWidth: number
  strokeStyle: 'solid' | 'dashed' | 'dotted'
  roughness: number
  opacity: number
  points?: Point[]
  text?: string
  fontFamily?: string
  fontSize?: number
}

export type Tool =
  | 'select'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pencil'
  | 'text'
  | 'pan'

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}
