import { useEffect, useId, useRef, useState } from 'react'
import type {
  PlannerSlotOption,
  TutorialSlotSelectLayout,
} from '../utils/plannerSlotSelection.ts'

function TutorialSlotColumns({
  option,
  layout,
}: {
  option: PlannerSlotOption
  layout: TutorialSlotSelectLayout
}) {
  return (
    <span
      className="grid min-w-0 flex-1 items-center gap-x-1.5 text-left"
      style={{
        gridTemplateColumns: `${layout.dayWidthCh}ch ${layout.timeWidthCh}ch minmax(0, 1fr)`,
      }}
    >
      <span>{option.dayLabel}</span>
      <span className="whitespace-nowrap tabular-nums">{option.timeLabel}</span>
      <span className="min-w-0 break-words" title={option.room || undefined}>{option.room || '—'}</span>
    </span>
  )
}

export function TutorialSlotSelect({
  options,
  selectedSlotId,
  layout,
  onSelect,
}: {
  options: readonly PlannerSlotOption[]
  selectedSlotId: string
  layout: TutorialSlotSelectLayout
  onSelect: (slotId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selectedOption = options.find((option) => option.slotId === selectedSlotId) ?? options[0]

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!selectedOption) {
    return null
  }

  const contentWidthCh = layout.dayWidthCh + layout.timeWidthCh + layout.roomWidthCh

  return (
    <div
      ref={rootRef}
      className="relative grid max-w-full min-w-0"
      style={{ width: `min(100%, calc(${contentWidthCh}ch + 3.25rem))` }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => setIsOpen((current) => !current)}
        className="relative flex w-full min-w-0 items-center rounded-md border border-border bg-surface px-2 py-1.5 pr-7 text-[10.5px] text-fg outline-none transition-colors hover:bg-surface-hover/35 focus:border-fg-muted sm:text-[11px]"
      >
        <TutorialSlotColumns option={selectedOption} layout={layout} />
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`absolute right-2 h-3 w-3 text-fg-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Tutorial slot"
          className="absolute inset-x-0 top-full z-40 mt-1 grid overflow-hidden rounded-md border border-border bg-surface shadow-lg"
        >
          {options.map((option) => {
            const isSelected = option.slotId === selectedOption.slotId
            return (
              <button
                key={option.slotId}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(option.slotId)
                  setIsOpen(false)
                }}
                className={`flex min-w-0 items-center px-2 py-2 pr-7 text-[10.5px] text-fg transition-colors sm:text-[11px] ${
                  isSelected
                    ? 'bg-surface-hover font-medium'
                    : 'hover:bg-surface-hover/55'
                }`}
              >
                <TutorialSlotColumns option={option} layout={layout} />
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
