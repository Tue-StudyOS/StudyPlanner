import { BookmarkIcon } from './icons'

interface FavStarProps {
  active: boolean
  disabled?: boolean
  onToggle: () => void
}

export function FavStar({ active, disabled = false, onToggle }: FavStarProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={active ? 'Remove from interested' : 'Mark as interested'}
      aria-pressed={active}
      className="flex shrink-0 items-center justify-center rounded-md p-1 text-primary transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BookmarkIcon filled={active} />
    </button>
  )
}
