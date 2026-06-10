import { useMemo } from 'react'
import type { Course } from '../../courses'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks } from '../utils/plannerFeedback'
import { TrashIcon } from './icons'

export function PlannerWeeklyListView({
  plannedCourses,
  hiddenSlotIds,
  isEditing,
  onRemoveSlot,
}: {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  isEditing: boolean
  onRemoveSlot: (slotId: string) => void
}) {
  const blocks = useMemo(
    () => buildPlannerBlocks(plannedCourses).filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [hiddenSlotIds, plannedCourses],
  )

  return (
    <div className="grid min-w-0 gap-3">
      {DAY_ORDER.map((day) => {
        const dayBlocks = blocks.filter((block) => block.day === day)
        return (
          <div
            key={day}
            className="min-w-0 overflow-hidden rounded-[10px] border border-border-light bg-surface-hover/25 px-3 py-4 sm:px-4"
          >
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              {DAY_LABELS[day]}
            </div>
            {dayBlocks.length === 0 ? (
              <div className="text-[12.5px] text-fg-muted">No planned courses for this day.</div>
            ) : (
              <div className="grid gap-2">
                {dayBlocks.map((block) => (
                  <div
                    key={block.blockId}
                    className={`min-w-0 overflow-hidden rounded-[10px] border px-3 py-3 text-[12px] ${
                      block.hasOverlap
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-fg'
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-semibold leading-5">{block.courseTitle}</div>
                        <div className="break-words text-[11.5px] opacity-85">{block.label}</div>
                        <div className="break-words text-[11.5px] opacity-85">{block.room}</div>
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => onRemoveSlot(block.slotId)}
                          aria-label={`Remove ${block.courseTitle} from this time slot`}
                          className="shrink-0 rounded-md border border-border p-2 text-fg transition-colors hover:bg-surface-hover"
                        >
                          <TrashIcon />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
