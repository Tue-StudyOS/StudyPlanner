import type { CourseParallelGroup } from '../../courses'
import { getRoleColor } from '../utils/courseBadge.ts'
import {
  summarizeGroupRoom,
  summarizeGroupSchedule,
  summarizeGroupSeats,
} from '../utils/parallelGroupSummary.ts'

interface ParallelGroupPickerProps {
  groups: CourseParallelGroup[]
  selectedPosition: number | null
  onSelect: (position: number) => void
}

/**
 * Lets the user pick which parallel group of a course goes on the calendar
 * (e.g. the lecture vs. a specific tutorial slot). Rendered only when a course
 * has more than one group; the same control is used to switch groups later.
 */
export function ParallelGroupPicker({
  groups,
  selectedPosition,
  onSelect,
}: ParallelGroupPickerProps) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        Group
      </legend>
      <div className="grid gap-2">
        {groups.map((group) => {
          const isSelected = group.position === selectedPosition
          const roleColor = getRoleColor(group.role)
          const room = summarizeGroupRoom(group)
          const seats = summarizeGroupSeats(group)
          return (
            <button
              key={group.position}
              type="button"
              onClick={() => onSelect(group.position)}
              aria-pressed={isSelected}
              className={`flex w-full min-w-0 items-start gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-surface hover:border-primary/40'
              }`}
            >
              <span
                aria-hidden
                className="mt-1 h-3 w-3 shrink-0 rounded-full border border-black/10 dark:border-white/15"
                style={roleColor ? { backgroundColor: roleColor } : undefined}
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  {group.role ? (
                    <span className="text-[12.5px] font-semibold text-fg">{group.role}</span>
                  ) : null}
                  {group.title ? (
                    <span className="min-w-0 break-words text-[12px] text-fg-mid">
                      {group.title}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block break-words text-[11.5px] text-fg-muted">
                  {summarizeGroupSchedule(group)}
                  {room ? ` · ${room}` : ''}
                  {seats ? ` · ${seats}` : ''}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
