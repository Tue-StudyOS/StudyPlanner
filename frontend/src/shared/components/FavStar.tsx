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
  const [feedbackKey, setFeedbackKey] = useState<number>(0)
  const showFilled = isLoading ? active : isHovered ? !active : active

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!active) {
          setFeedbackKey((current) => current + 1)
        }
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
      className={`relative flex shrink-0 items-center justify-center overflow-visible rounded-full p-1 text-primary transition-colors disabled:cursor-default disabled:opacity-60 ${
        isLoading ? 'animate-pulse' : ''
      }`}
    >
      {feedbackKey > 0 ? (
        <span key={feedbackKey} aria-hidden className="favorite-save-burst">
          <span />
          <span />
          <span />
        </span>
      ) : null}
      <span key={`favorite-pop-${feedbackKey}`} className={feedbackKey > 0 ? 'favorite-save-pop' : undefined}>
        <BookmarkIcon filled={showFilled} />
      </span>
    </button>
  )
}
