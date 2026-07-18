import { useEffect, useState, useCallback } from 'react'
import type { Element } from '../types'
import {
  loadElements,
  saveElement,
  saveElements,
  removeElement,
} from '../db/elements'

export function useElements() {
  const [elements, setElements] = useState<Element[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadElements()
      .then(setElements)
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
    await saveElement(element)
  }, [])

  const upsertElements = useCallback(async (newElements: Element[]) => {
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
    await saveElements(newElements)
  }, [])

  const deleteElement = useCallback(async (id: string) => {
    setElements((prev) => prev.filter((e) => e.id !== id))
    await removeElement(id)
  }, [])

  const deleteElements = useCallback(async (ids: string[]) => {
    setElements((prev) => prev.filter((e) => !ids.includes(e.id)))
    await Promise.all(ids.map(removeElement))
  }, [])

  const bringToFront = useCallback(async (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return prev
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.push(el)
      saveElements(next)
      return next
    })
  }, [])

  const sendToBack = useCallback(async (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.unshift(el)
      saveElements(next)
      return next
    })
  }, [])

  const bringForward = useCallback(async (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx === -1 || idx === prev.length - 1) return prev
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx + 1, 0, el)
      saveElements(next)
      return next
    })
  }, [])

  const sendBackward = useCallback(async (id: string) => {
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      const [el] = next.splice(idx, 1)
      next.splice(idx - 1, 0, el)
      saveElements(next)
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
  }
}
