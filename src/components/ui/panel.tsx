import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps): ReactNode {
  return (
    <div
      className={`rounded-lg border border-black/[0.04] bg-white/70 backdrop-blur-xl shadow-[0_1px_4px_-2px_rgba(0,0,0,0.08)] dark:border-white/[0.06] dark:bg-zinc-900/70 dark:shadow-[0_1px_4px_-2px_rgba(0,0,0,0.3)] ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
