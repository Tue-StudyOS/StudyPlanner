import { useState } from 'react'
import { BookmarkIcon } from './icons'

interface FavStarProps {
  active: boolean
  disabled?: boolean
  onToggle: () => void
}

export function FavStar({ active, disabled = false, onToggle }: FavStarProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const showFilled = isHovered ? !active : active

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      disabled={disabled}
      aria-label={active ? 'Remove from interested' : 'Mark as interested'}
      aria-pressed={active}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="flex shrink-0 items-center justify-center p-1 text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    >
      <BookmarkIcon filled={showFilled} />
    </button>
  )
}
