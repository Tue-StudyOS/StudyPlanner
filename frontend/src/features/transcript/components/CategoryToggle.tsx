import { CAT_BADGE_CLASSES } from '../../../shared/components/catClasses'
import type { MasterCat } from '../../courses'

interface CategoryToggleProps {
  cat: MasterCat
  active: boolean
  onClick: () => void
}

export function CategoryToggle({ cat, active, onClick }: CategoryToggleProps) {
  const stateClasses = active
    ? CAT_BADGE_CLASSES[cat]
    : 'border-pill-border bg-pill-bg text-pill-text hover:bg-surface-hover'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.04em] transition-colors ${stateClasses}`}
    >
      {cat}
    </button>
  )
}
