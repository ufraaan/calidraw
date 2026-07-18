import type { ReactNode } from 'react'

interface PanelProps {
  children: ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps): ReactNode {
  return (
    <div
      className={`rounded-xl border border-zinc-200/60 bg-white/75 backdrop-blur-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] dark:border-zinc-700/50 dark:bg-zinc-900/80 dark:shadow-[0_2px_12px_-4px_rgba(0,0,0,0.3)] ${className ?? ''}`}
    >
      {children}
    </div>
  )
}
