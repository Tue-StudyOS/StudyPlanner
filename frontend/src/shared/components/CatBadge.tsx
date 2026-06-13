import type { MasterCat } from '../../features/courses'
import { CAT_BADGE_CLASSES } from './catClasses'

interface CatBadgeProps {
  cat: MasterCat
}

export function CatBadge({ cat }: CatBadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-[1.4] tracking-[0.04em] ${CAT_BADGE_CLASSES[cat]}`}
    >
      {cat}
    </span>
  )
}
