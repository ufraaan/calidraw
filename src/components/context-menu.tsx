import { useRef, useEffect, useState, useLayoutEffect } from 'react'
import type { ReactNode } from 'react'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const handleScroll = () => onClose()
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleEsc)
      window.addEventListener('scroll', handleScroll, true)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [onClose])

  // Measured flip — keeps the menu on screen regardless of size.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    })
    // Focus first item for keyboard nav.
    const first = el.querySelector<HTMLButtonElement>('button:not([disabled])')
    first?.focus()
  }, [x, y])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const items = [...el.querySelectorAll<HTMLButtonElement>('button:not([disabled])')]
      const idx = items.indexOf(document.activeElement as HTMLButtonElement)
      const next = e.key === 'ArrowDown' ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length
      items[next]?.focus()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Canvas context menu"
      className="fixed z-50 min-w-[200px] rounded-lg border border-zinc-200 bg-white py-1 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: pos.left, top: pos.top }}
    >
      {children}
    </div>
  )
}

interface MenuItemProps {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
  shortcut?: string
}

export function MenuItem({ onClick, children, disabled, shortcut }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors ${
        disabled
          ? 'cursor-default text-zinc-300 dark:text-zinc-600'
          : 'text-zinc-600 hover:bg-[#e8a07a]/10 active:bg-[#e8a07a]/15 dark:text-zinc-400 dark:hover:bg-[#e8a07a]/15'
      }`}
      onClick={onClick}
    >
      <span className="flex flex-1 items-center gap-2.5">{children}</span>
      {shortcut && (
        <kbd className="rounded border border-zinc-200 px-1 text-[10px] text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

export function MenuSeparator() {
  return (
    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
  )
}
