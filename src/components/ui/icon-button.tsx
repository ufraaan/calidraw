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
      className={`ui-iconbtn ${active ? 'is-active' : ''} ${s} ${className ?? ''}`}
    >
      {children}
    </button>
  )
}
