import type { ReactNode } from 'react'

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  className?: string
  size?: 'sm' | 'xs'
}
export function IconButton({
  children,
  onClick,
  active,
  disabled,
  title,
  className,
  size = 'sm',
}: IconButtonProps): ReactNode {
  const s = size === 'xs' ? 'size-7' : 'size-8'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${s} flex items-center justify-center rounded-md text-zinc-400 transition-all duration-100 hover:text-zinc-700 active:scale-95 disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-200 ${
        active
          ? 'bg-black/[0.04] text-zinc-800 dark:bg-white/[0.06] dark:text-zinc-100'
          : ''
      } ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
