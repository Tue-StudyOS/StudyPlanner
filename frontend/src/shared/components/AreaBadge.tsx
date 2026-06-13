import type { MasterCat } from '../../features/courses'
import { CAT_BADGE_CLASSES } from './catClasses'

// Areas without a mapped master category (e.g. Bioinformatik or media areas of
// other regulations) still get a readable, neutral badge.
const NEUTRAL_BADGE_CLASS = 'text-fg-mid border-border bg-surface-hover'

interface AreaBadgeProps {
  label: string
  masterCat: MasterCat | null
}

/**
 * Study-area tag whose color follows the area's master category when there is
 * one, and whose label is the regulation-specific short code. Shares the exact
 * visual style of {@link CatBadge}.
 */
export function AreaBadge({ label, masterCat }: AreaBadgeProps) {
  const colorClass = masterCat ? CAT_BADGE_CLASSES[masterCat] : NEUTRAL_BADGE_CLASS
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-[1.4] tracking-[0.04em] ${colorClass}`}
    >
      {label}
    </span>
  )
}
