import { createFileRoute } from '@tanstack/react-router'
import { CanvasView } from '../components/canvas'
import type { ReactNode } from 'react'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage(): ReactNode {
  return <CanvasView />
}
