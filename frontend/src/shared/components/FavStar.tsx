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
  const [feedback, setFeedback] = useState<{ key: number; type: 'add' | 'remove' } | null>(null)
  const showFilled = isLoading ? active : isHovered ? !active : active

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setFeedback((current) => ({
          key: (current?.key ?? 0) + 1,
          type: active ? 'remove' : 'add',
        }))
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
      {feedback ? (
        <span
          key={`favorite-feedback-${feedback.key}`}
          aria-hidden
          className={feedback.type === 'add' ? 'favorite-save-burst' : 'favorite-remove-ring'}
        />
      ) : null}
      <span
        key={`favorite-pop-${feedback?.key ?? 0}`}
        className={feedback ? `favorite-${feedback.type}-pop` : undefined}
      >
        <BookmarkIcon filled={showFilled} />
      </span>
    </button>
  )
}
