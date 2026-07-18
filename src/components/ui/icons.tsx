import { IconPointer, IconSquareRounded, IconDiamonds, IconOval, IconArrowUpRight, IconLine as TbLine, IconPencil as TbPencil, IconTypography, IconHandMove, IconTarget } from '@tabler/icons-react'
import type { ReactNode } from 'react'

const p = { size: 18, stroke: 1.5 }

export function IconSelect(): ReactNode { return <IconPointer {...p} /> }
export function IconRect(): ReactNode { return <IconSquareRounded {...p} /> }
export function IconDiamond(): ReactNode { return <IconDiamonds {...p} /> }
export function IconEllipse(): ReactNode { return <IconOval {...p} /> }
export function IconArrow(): ReactNode { return <IconArrowUpRight {...p} /> }
export function IconLine(): ReactNode { return <TbLine {...p} /> }
export function IconPencil(): ReactNode { return <TbPencil {...p} /> }
export function IconText(): ReactNode { return <IconTypography {...p} /> }
export function IconPan(): ReactNode { return <IconHandMove {...p} /> }
export function IconLaser(): ReactNode { return <IconTarget {...p} /> }
