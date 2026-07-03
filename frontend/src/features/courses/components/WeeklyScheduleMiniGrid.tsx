import { useMemo } from 'react'
import { DAY_LABELS, DAY_ORDER } from '../../planner/utils/plannerFeedback'
import { buildDayLayout } from '../../planner/utils/plannerDayLayout'
import {
  buildMiniGridBlocks,
  collapseMiniGridBlocksForCalendar,
  MINI_GRID_END_MINUTES,
  MINI_GRID_LABEL_SEPARATOR,
  MINI_GRID_START_MINUTES,
} from '../utils/weeklyScheduleMiniGrid.ts'
import {
  scheduleSlotDotClasses,
  scheduleSlotGridBlockClasses,
  scheduleSlotListLabelClasses,
} from '../utils/scheduleSlotKind.ts'
import type { ScheduleSlot } from '../types'

const GRID_HEIGHT_PX = 120

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, MINI_GRID_START_MINUTES), MINI_GRID_END_MINUTES)
  return ((clamped - MINI_GRID_START_MINUTES) / (MINI_GRID_END_MINUTES - MINI_GRID_START_MINUTES)) * 100
}

/**
 * Compact Mon–Fri grid with distinct exam/resit coloring.
 */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const blocks = useMemo(() => buildMiniGridBlocks(schedule), [schedule])
  const calendarBlocks = useMemo(() => collapseMiniGridBlocksForCalendar(blocks), [blocks])

  const listEntries = useMemo(
    () =>
      [...blocks].sort((left, right) => {
        if (left.slotKind === 'weekly' && right.slotKind !== 'weekly') return -1
        if (left.slotKind !== 'weekly' && right.slotKind === 'weekly') return 1
        return left.label.localeCompare(right.label)
      }),
    [blocks],
  )

  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [
          day,
          buildDayLayout(calendarBlocks.filter((block) => block.day === day)),
        ]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [calendarBlocks],
  )

  return (
    <div>
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

      {blocks.length === 0 ? (
        <div className="mt-2 text-[12px] text-fg-muted">No weekly times published yet.</div>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {listEntries.map((block) => {
            const isExamSlot = block.slotKind === 'exam' || block.slotKind === 'resit'
            const primaryLabel = block.label.split(MINI_GRID_LABEL_SEPARATOR)[0]
            return (
              <li key={block.blockId} className="flex items-start gap-2 text-[12px]">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${scheduleSlotDotClasses(block.slotKind)}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg">{primaryLabel}</div>
                  {block.room && block.room !== 'TBA' ? (
                    <div className="text-fg-muted">{block.room}</div>
                  ) : null}
                  {isExamSlot ? (
                    <div className={`text-[11px] ${scheduleSlotListLabelClasses(block.slotKind)}`}>
                      {block.slotType}
                    </div>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
