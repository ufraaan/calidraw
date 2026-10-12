import { useEffect, useState, useCallback, useRef } from 'react'
import type { Element } from '../types'
import {
  loadElements,
  saveElement,
  saveElements,
  removeElement,
} from '../db/elements'
import { db } from '../db/schema'

export function useElements() {
  const [elements, setElements] = useState<Element[]>([])
  const [loading, setLoading] = useState(true)
  const elementsRef = useRef<Element[]>([])
  elementsRef.current = elements

  useEffect(() => {
    loadElements()
      .then(setElements)
      .catch(() => setElements([]))
      .finally(() => setLoading(false))
  }, [])

  const upsertElement = useCallback(async (element: Element) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === element.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = element
        return next
      }
      return [...prev, element]
    })
    try {
      await saveElement(element)
    } catch {
      /* IndexedDB full/blocked — keep in-memory state */
    }
  }, [])

  const upsertElements = useCallback(async (newElements: Element[]) => {
    if (newElements.length === 0) return
    setElements((prev) => {
      const next = [...prev]
      for (const el of newElements) {
        const idx = next.findIndex((e) => e.id === el.id)
        if (idx >= 0) {
          next[idx] = el
        } else {
          next.push(el)
        }
      }
      return next
    })
    try {
      // Only write dirty elements, not the whole scene.
      await saveElements(newElements)
    } catch {
      /* ignore */
    }
  }, [])

  const deleteElement = useCallback(async (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id))
    try {
      await removeElement(id)
    } catch {
      /* ignore */
    }
  }, [])

  const deleteElements = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setElements((prev) => prev.filter((e) => !idSet.has(e.id)))
    try {
      await Promise.all(ids.map(removeElement))
    } catch {
      /* ignore */
    }
  }, [])

  /** Direct replace — used by undo/redo to restore a previous snapshot.
   * Writes dirty elements and deletes removed ones (no full bulkPut). */
  const replaceElements = useCallback(async (newElements: Element[]) => {
    const prev = elementsRef.current
    const prevIds = new Set(prev.map((e) => e.id))
    const nextIds = new Set(newElements.map((e) => e.id))
    const removed = [...prevIds].filter((id) => !nextIds.has(id))
    setElements(newElements)
    try {
      if (newElements.length > 0) await saveElements(newElements)
      if (removed.length > 0) await db.elements.bulkDelete(removed)
    } catch {
      /* ignore */
    }
  }, [])

  function reorder(compute: (prev: Element[]) => Element[] | null) {
    const prev = elementsRef.current
    const next = compute(prev)
    if (!next || next === prev) return
    setElements(next)
    // Order is part of the scene — persist, but only the order-affected ids.
    // Fire-and-forget; failures keep in-memory order.
    saveElements(next).catch(() => {})
  }

  const bringToFront = useCallback(async (id: string) => {
    reorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.push(el)
      return next
    })
  }, [])

  const sendToBack = useCallback(async (id: string) => {
    reorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.unshift(el)
      return next
    })
  }, [])

  const bringForward = useCallback(async (id: string) => {
    reorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx + 1, 0, el)
      return next
    })
  }, [])

  const sendBackward = useCallback(async (id: string) => {
    reorder((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return null
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx - 1, 0, el)
      return next
    })
  }, [])

  return {
    elements,
    loading,
    upsertElement,
    upsertElements,
    deleteElement,
    deleteElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    setElements,
    replaceElements,
  }
}
