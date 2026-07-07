import { useState } from 'react'
import { BookmarkIcon } from './icons'

interface FavStarProps {
  active: boolean
  disabled?: boolean
  isLoading?: boolean
  onToggle: () => void
}

export function FavStar({ active, disabled = false, isLoading = false, onToggle }: FavStarProps) {
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const showFilled = isLoading ? active : isHovered ? !active : active

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle()
      }}
      disabled={disabled || isLoading}
      aria-label={isLoading ? 'Saving interested status' : active ? 'Remove from interested' : 'Mark as interested'}
      aria-pressed={active}
      aria-busy={isLoading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className={`flex shrink-0 items-center justify-center p-1 text-primary transition-colors disabled:cursor-default disabled:opacity-60 ${
        isLoading ? 'animate-pulse' : ''
      }`}
    >
      <BookmarkIcon filled={showFilled} />
    </button>
  )
}
