import { useMemo } from 'react'
import {
  DAY_LABELS,
  DAY_ORDER,
  isSingleDateSlot,
  normalizeWeekday,
  parseTimeRange,
} from '../../planner/utils/plannerFeedback'
import type { ScheduleSlot } from '../types'

const GRID_START_MINUTES = 8 * 60
const GRID_END_MINUTES = 20 * 60
const GRID_HEIGHT_PX = 132
const HOUR_MARKS = [8, 12, 16, 20]

interface MiniGridBlock {
  key: string
  day: (typeof DAY_ORDER)[number]
  startMinutes: number
  endMinutes: number
  label: string
}

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, GRID_START_MINUTES), GRID_END_MINUTES)
  return ((clamped - GRID_START_MINUTES) / (GRID_END_MINUTES - GRID_START_MINUTES)) * 100
}

/**
 * Compact Mon-Fri grid that marks the course's weekly time slots as colored
 * blocks. Always renders, even without time data, so the schedule section
 * keeps a stable shape ("empty" still communicates something).
 */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const blocks = useMemo(() => {
    const parsedBlocks: MiniGridBlock[] = []
    schedule.forEach((slot, index) => {
      // Exam dates and other one-off appointments are not weekly slots; they
      // belong in the exam dates section, not in this grid.
      if (isSingleDateSlot(slot.day)) {
        return
      }
      const day = normalizeWeekday(slot.day)
      const timeRange = parseTimeRange(slot.time)
      if (!day || !timeRange) {
        return
      }
      parsedBlocks.push({
        key: `${slot.day}-${slot.time}-${index}`,
        day,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
        label: `${DAY_LABELS[day]} ${slot.time}${slot.room && slot.room !== 'TBA' ? ` · ${slot.room}` : ''}`,
      })
    })
    return parsedBlocks
  }, [schedule])

  return (
    <div>
      <div className="grid grid-cols-[2rem_repeat(5,minmax(0,1fr))] gap-1">
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
          {HOUR_MARKS.map((hour) => (
            <div
              key={hour}
              className="absolute right-1 -translate-y-1/2 text-[9px] text-fg-muted"
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
            {HOUR_MARKS.slice(1, -1).map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-border-light/70"
                style={{ top: `${toPercent(hour * 60)}%` }}
              />
            ))}
            {blocks
              .filter((block) => block.day === day)
              .map((block) => (
                <div
                  key={block.key}
                  title={block.label}
                  className="absolute inset-x-0.5 rounded-[4px] border border-primary/50 bg-primary/25"
                  style={{
                    top: `${toPercent(block.startMinutes)}%`,
                    height: `${Math.max(toPercent(block.endMinutes) - toPercent(block.startMinutes), 4)}%`,
                  }}
                />
              ))}
          </div>
        ))}
      </div>

      {blocks.length === 0 ? (
        <div className="mt-2 text-[12px] text-fg-muted">No weekly times published yet.</div>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1">
          {schedule.map((slot, index) => {
            if (isSingleDateSlot(slot.day)) {
              return null
            }
            const day = normalizeWeekday(slot.day)
            const timeRange = parseTimeRange(slot.time)
            if (!day || !timeRange) {
              return null
            }
            return (
              <li key={`${slot.day}-${slot.time}-${index}`} className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-fg-mid">
                <span className="font-medium text-fg">
                  {DAY_LABELS[day]} {slot.time}
                </span>
                {slot.room && slot.room !== 'TBA' ? <span className="text-fg-muted">{slot.room}</span> : null}
                {slot.type && slot.type !== 'Course' ? <span className="text-fg-muted">· {slot.type}</span> : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
