import type { ReactNode } from 'react'

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  className?: string
  size?: 'sm' | 'md'
}
export function IconButton({

  children,
  onClick,
  active,
  disabled,
  title,
  className,
  size = 'md',
}: IconButtonProps): ReactNode {
  const s = size === 'sm' ? 'size-7' : 'size-9'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${s} flex items-center justify-center rounded-lg text-zinc-500 transition-all duration-100 hover:bg-zinc-100 hover:text-zinc-700 active:scale-95 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${
        active
          ? 'bg-zinc-100 text-zinc-800 shadow-inner dark:bg-zinc-800 dark:text-zinc-100'
          : ''
      } ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
