import { db } from './schema'
import type { Element } from '../types'

export async function loadElements(): Promise<Element[]> {
  return db.elements.toArray()
}

export async function saveElement(element: Element): Promise<void> {
  await db.elements.put(element)
}

export async function saveElements(elements: Element[]): Promise<void> {
  await db.elements.bulkPut(elements)
}

export async function removeElement(id: string): Promise<void> {
  await db.elements.delete(id)
}

async function removeElements(ids: string[]): Promise<void> {
  await db.elements.bulkDelete(ids)
}

async function clearElements(): Promise<void> {
  await db.elements.clear()
}
