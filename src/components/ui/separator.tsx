import type { ReactNode } from 'react'

function Separator({ className }: { className?: string }): ReactNode {
  return (
    <div
      className={`h-px bg-zinc-200 dark:bg-zinc-700 ${className ?? ''}`}
    />
  )
}

export function VSeparator({ className }: { className?: string }): ReactNode {
  return (
    <div
      className={`w-px bg-zinc-200 dark:bg-zinc-700 self-stretch ${className ?? ''}`}
    />
  )
}
