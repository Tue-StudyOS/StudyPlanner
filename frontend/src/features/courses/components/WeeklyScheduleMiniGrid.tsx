import { useMemo } from 'react'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks, isSingleDateSlot } from '../../planner/utils/plannerFeedback.ts'
import { buildDayLayout } from '../../planner/utils/plannerDayLayout.ts'
import { scheduleSlotGridBlockClasses } from '../utils/scheduleSlotKind.ts'
import type { ScheduleSlot } from '../types.ts'

const GRID_HEIGHT_PX = 120
const MINI_GRID_START_MINUTES = 8 * 60
const MINI_GRID_END_MINUTES = 20 * 60

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, MINI_GRID_START_MINUTES), MINI_GRID_END_MINUTES)
  return ((clamped - MINI_GRID_START_MINUTES) / (MINI_GRID_END_MINUTES - MINI_GRID_START_MINUTES)) * 100
}

/** Compact Mon–Fri grid for recurring teaching appointments only. */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const weeklySchedule = useMemo(
    () => schedule.filter(
      (slot) => slot.calendarRelevant !== false && !isSingleDateSlot(slot.day),
    ),
    [schedule],
  )
  const blocks = useMemo(
    () => buildPlannerBlocks([
      {
        id: 'mini-grid',
        number: '',
        title: '',
        lecturer: '',
        room: '',
        types: [],
        ects: null,
        sws: null,
        masterCats: [],
        weekdays: [],
        schedule: weeklySchedule,
        frequency: '',
        language: '',
        prerequisites: [],
        description: '',
        exams: [],
      },
    ]),
    [weeklySchedule],
  )
  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [
          day,
          buildDayLayout(blocks.filter((block) => block.day === day)),
        ]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks],
  )

  return (
    <div className="min-w-0">
      <div className="grid grid-cols-[1.75rem_repeat(5,minmax(0,1fr))] gap-1">
        <div />
        {DAY_ORDER.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-fg-muted"
          >
            {DAY_LABELS[day]}
          </div>
        ))}

        <div className="relative" style={{ height: `${GRID_HEIGHT_PX}px` }}>
          {[8, 12, 16, 20].map((hour) => (
            <div
              key={hour}
              className="absolute right-1 -translate-y-1/2 text-[9px] tabular-nums leading-none text-fg-muted"
              style={{ top: `${toPercent(hour * 60)}%` }}
            >
              {hour}
            </div>
          ))}
        </div>

        {DAY_ORDER.map((day) => (
          <div
            key={day}
            className="relative overflow-hidden rounded-md border border-border-light bg-surface-hover/25"
            style={{ height: `${GRID_HEIGHT_PX}px` }}
          >
            {[12, 16].map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border-light/70"
                style={{ top: `${toPercent(hour * 60)}%` }}
              />
            ))}
            {dayLayouts[day].visibleBlocks.map((block) => {
              const widthPercent = 100 / block.visibleColumnCount
              return (
                <div
                  key={block.blockId}
                  title={block.label}
                  className={`absolute rounded-[3px] border ${scheduleSlotGridBlockClasses(block.slotKind)}`}
                  style={{
                    top: `${toPercent(block.startMinutes)}%`,
                    height: `${Math.max(toPercent(block.endMinutes) - toPercent(block.startMinutes), 4)}%`,
                    left: `calc(${widthPercent * block.columnIndex}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
