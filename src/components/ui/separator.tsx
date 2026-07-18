import type { ReactNode } from 'react'

export function VSeparator({ className }: { className?: string }): ReactNode {
  return (
    <div
      className={`w-px bg-zinc-200 dark:bg-zinc-700 self-stretch ${className ?? ''}`}
    />
  )
}
