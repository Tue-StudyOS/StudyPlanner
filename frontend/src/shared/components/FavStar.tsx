import { StarIcon } from './icons'

interface FavStarProps {
  active: boolean
  onToggle: () => void
}

export function FavStar({ active, onToggle }: FavStarProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={active ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={active}
      className="flex shrink-0 items-center justify-center rounded-md p-1 text-primary transition-colors hover:bg-surface-hover"
    >
      <StarIcon filled={active} />
    </button>
  )
}
