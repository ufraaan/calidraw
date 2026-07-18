import Dexie, { type Table } from 'dexie'
import type { Element } from '../types'

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
