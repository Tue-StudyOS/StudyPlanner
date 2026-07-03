import type { MasterCat } from '../../features/courses'
import { CAT_BADGE_CLASSES } from './catClasses'

const NEUTRAL_BADGE_CLASS = 'text-fg-mid border-border bg-surface-hover'

interface AreaBadgeProps {
  label: string
  masterCat: MasterCat | null
  active?: boolean
  onClick?: () => void
}

/**
 * Study-area tag whose color follows the area's master category when there is
 * one. Optional click handler sets catalog filters without navigating away.
 */
export function AreaBadge({ label, masterCat, active = false, onClick }: AreaBadgeProps) {
  const colorClass = masterCat ? CAT_BADGE_CLASSES[masterCat] : NEUTRAL_BADGE_CLASS
  const className = `inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase leading-[1.4] tracking-[0.04em] transition-colors ${colorClass} ${
    active ? 'ring-1 ring-primary/50' : ''
  } ${onClick ? 'cursor-pointer hover:opacity-90' : ''}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onClick()
        }}
        className={className}
      >
        {label}
      </button>
    )
  }

  return <span className={className}>{label}</span>
}
