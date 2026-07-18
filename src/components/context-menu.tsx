import { useRef, useEffect } from 'react'
import type { ReactNode } from 'react'

interface ContextMenuProps {
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleEsc)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 300)

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[172px] rounded-lg border border-zinc-200 bg-white py-1 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {children}
    </div>
  )
}

interface MenuItemProps {
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}

export function MenuItem({ onClick, children, disabled }: MenuItemProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors ${
        disabled
          ? 'cursor-default text-zinc-300 dark:text-zinc-600'
          : 'text-zinc-600 hover:bg-zinc-100 active:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return (
    <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
  )
}
