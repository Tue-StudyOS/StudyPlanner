interface StarRatingProps {
  value: number
  label: string
  onChange?: (rating: number) => void
  size?: 'sm' | 'md'
  /** Lets an optional rating be unset by clicking the active star again. */
  clearable?: boolean
}

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'h-7 w-7 text-[13px]',
  md: 'h-9 w-9 text-lg',
}

export function StarRating({
  value,
  label,
  onChange,
  size = 'md',
  clearable = false,
}: StarRatingProps) {
  const isReadOnly = !onChange

  if (isReadOnly) {
    return (
      <span className="inline-flex items-center gap-0.5 text-primary" aria-label={label} role="img">
        {[1, 2, 3, 4, 5].map((rating) => (
          <span key={rating} aria-hidden="true" className={rating <= value ? '' : 'text-border'}>
            ★
          </span>
        ))}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((rating) => {
        const isActive = rating <= value
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
            onClick={() => onChange(clearable && value === rating ? 0 : rating)}
            className={`flex shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              SIZE_CLASSES[size]
            } ${
              isActive
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg'
            }`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
