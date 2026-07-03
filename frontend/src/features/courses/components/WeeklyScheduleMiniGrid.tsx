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
import type { ScheduleSlot } from '../types'

const GRID_HEIGHT_PX = 120

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, MINI_GRID_START_MINUTES), MINI_GRID_END_MINUTES)
  return ((clamped - MINI_GRID_START_MINUTES) / (MINI_GRID_END_MINUTES - MINI_GRID_START_MINUTES)) * 100
}

function getGridBlockClasses(): string {
  return 'border-primary/70 bg-primary/35'
}

function getDotClasses(): string {
  return 'bg-primary'
}

/**
 * Compact Mon–Fri grid. Weekly slots and one-off exam dates share the same
 * block styling; appointment types appear as notes in the list below.
 */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const blocks = useMemo(() => buildMiniGridBlocks(schedule), [schedule])
  const calendarBlocks = useMemo(() => collapseMiniGridBlocksForCalendar(blocks), [blocks])

  const listEntries = useMemo(
    () =>
      [...blocks].sort((left, right) => {
        if (left.kind === 'weekly' && right.kind !== 'weekly') return -1
        if (left.kind !== 'weekly' && right.kind === 'weekly') return 1
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
                  className={`absolute rounded-[3px] border ${getGridBlockClasses()}`}
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
        <ul className="mt-2.5 flex flex-col gap-1">
          {listEntries.map((block) => (
            <li
              key={block.blockId}
              className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-fg-mid"
            >
              <span className={`inline-block h-2 w-2 self-center rounded-full ${getDotClasses()}`} />
              <span className="font-medium text-fg">{block.label.split(MINI_GRID_LABEL_SEPARATOR)[0]}</span>
              {block.room && block.room !== 'TBA' ? (
                <span className="text-fg-muted">{block.room}</span>
              ) : null}
              {block.slotType && block.slotType !== 'Course' ? (
                <span className="text-[11px] text-fg-muted">{block.slotType}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
