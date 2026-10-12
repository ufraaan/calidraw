import type { ReactNode } from 'react'

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  ariaLabel?: string
  ariaPressed?: boolean
  className?: string
  size?: 'sm' | 'xs'
}
export function IconButton({
  children,
  onClick,
  active,
  disabled,
  title,
  ariaLabel,
  ariaPressed,
  className,
  size = 'sm',
}: IconButtonProps): ReactNode {
  const s = size === 'xs' ? 'size-7 min-h-[28px] min-w-[28px]' : 'size-8 min-h-[32px] min-w-[32px]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={ariaPressed ?? active}
      className={`${s} flex items-center justify-center rounded-md transition-all duration-100 active:scale-95 disabled:opacity-30 ${
        active
          ? 'bg-[#e8a07a]/15 text-[#e8a07a] dark:bg-[#e8a07a]/20 dark:text-[#e8a07a]'
          : 'text-zinc-400 hover:text-zinc-700 dark:text-zinc-500 dark:hover:text-zinc-200'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
