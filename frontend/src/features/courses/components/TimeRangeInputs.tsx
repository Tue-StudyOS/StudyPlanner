import { useRef } from 'react'
import {
  completeTimeDigits,
  formatTimeDigits,
  sanitizeTimeDigits,
} from '../utils/timeInput.ts'

interface TimeRangeInputsProps {
  fromDigits: string
  toDigits: string
  onChangeFrom: (digits: string) => void
  onChangeTo: (digits: string) => void
}

/**
 * Masked time range: type plain digits ("1430" becomes 14:30), the cursor
 * jumps to the second field after four digits, and leaving a field with a
 * partial value fills the minutes with 00.
 */
export function TimeRangeInputs({
  fromDigits,
  toDigits,
  onChangeFrom,
  onChangeTo,
}: TimeRangeInputsProps) {
  const toInputRef = useRef<HTMLInputElement>(null)

  const inputClassName =
    'w-[4.25rem] rounded-md border border-border bg-surface px-2 py-1.5 text-center text-[12.5px] tabular-nums text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary'

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-fg-mid">
      <span>From</span>
      <input
        type="text"
        inputMode="numeric"
        placeholder="08:00"
        value={formatTimeDigits(fromDigits)}
        onChange={(event) => {
          const digits = sanitizeTimeDigits(event.target.value)
          onChangeFrom(digits)
          if (digits.length === 4) {
            toInputRef.current?.focus()
          }
        }}
        onBlur={() => onChangeFrom(completeTimeDigits(fromDigits))}
        aria-label="Earliest start time"
        className={inputClassName}
      />
      <span>to</span>
      <input
        ref={toInputRef}
        type="text"
        inputMode="numeric"
        placeholder="18:00"
        value={formatTimeDigits(toDigits)}
        onChange={(event) => onChangeTo(sanitizeTimeDigits(event.target.value))}
        onBlur={() => onChangeTo(completeTimeDigits(toDigits))}
        aria-label="Latest end time"
        className={inputClassName}
      />
    </div>
  )
}
