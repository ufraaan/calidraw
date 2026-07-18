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
    // Delay listener to avoid the right-click that opened it
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

  // Adjust position so menu stays inside viewport
  const adjustedX = Math.min(x, window.innerWidth - 200)
  const adjustedY = Math.min(y, window.innerHeight - 300)

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-lg border border-black/[0.04] bg-white/90 px-1 py-1 backdrop-blur-xl shadow-[0_8px_30px_-8px_rgba(0,0,0,0.2)] dark:border-white/[0.06] dark:bg-zinc-900/90 dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.4)]"
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
      className={`flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left text-[13px] transition-colors ${
        disabled
          ? 'cursor-not-allowed text-zinc-300 dark:text-zinc-600'
          : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function MenuSeparator() {
  return (
    <div className="my-1 border-t border-black/[0.06] dark:border-white/[0.06]" />
  )
}
