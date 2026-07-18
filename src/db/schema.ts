import Dexie, { type Table } from 'dexie'
import { z } from 'zod'
import type { Element, ElementType, Point } from '../types'

const pointSchema: z.ZodType<Point> = z.object({
  x: z.number(),
  y: z.number(),
})

export const elementSchema = z.object({
  id: z.string(),
  type: z.custom<ElementType>(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  angle: z.number(),
  strokeColor: z.string(),
  backgroundColor: z.string(),
  strokeWidth: z.number(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']),
  roughness: z.number(),
  opacity: z.number(),
  points: z.array(pointSchema).optional(),
  text: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
})

export class CaliDrawDB extends Dexie {
  elements!: Table<Element, string>

  constructor() {
    super('calidraw')
    this.version(1).stores({
      elements: 'id, type',
    })
  }
}

export const db = new CaliDrawDB()
