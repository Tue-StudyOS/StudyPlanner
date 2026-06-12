import { useMemo } from 'react'
import {
  DAY_LABELS,
  DAY_ORDER,
  isSingleDateSlot,
  normalizeWeekday,
  parseTimeRange,
  type PlannerBlock,
} from '../../planner/utils/plannerFeedback'
import { buildDayLayout } from '../../planner/utils/plannerDayLayout'
import type { ScheduleSlot } from '../types'

const GRID_START_MINUTES = 8 * 60
const GRID_END_MINUTES = 18 * 60
const GRID_HEIGHT_PX = 108

interface MiniGridBlock extends PlannerBlock {
  isExam: boolean
}

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, GRID_START_MINUTES), GRID_END_MINUTES)
  return ((clamped - GRID_START_MINUTES) / (GRID_END_MINUTES - GRID_START_MINUTES)) * 100
}

/**
 * Compact Mon-Fri grid marking weekly slots as primary-colored blocks and
 * one-off exam dates in a distinct accent color; overlapping blocks share the
 * column side by side. Always renders, even without time data.
 */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const blocks = useMemo(() => {
    const parsedBlocks: MiniGridBlock[] = []
    schedule.forEach((slot, index) => {
      const day = normalizeWeekday(slot.day)
      const timeRange = parseTimeRange(slot.time)
      if (!day || !timeRange || timeRange.endMinutes <= GRID_START_MINUTES) {
        return
      }
      const isExam = isSingleDateSlot(slot.day)
      // Exams keep their concrete date in the label; weekly slots show the day.
      const dayLabel = isExam ? slot.day.trim() : DAY_LABELS[day]
      parsedBlocks.push({
        blockId: `${slot.day}-${slot.time}-${index}`,
        slotId: `${index}`,
        courseId: '',
        courseTitle: '',
        day,
        startMinutes: timeRange.startMinutes,
        endMinutes: timeRange.endMinutes,
        label: `${dayLabel} ${slot.time}${slot.room && slot.room !== 'TBA' ? ` · ${slot.room}` : ''}`,
        room: slot.room,
        slotType: slot.type,
        hasOverlap: false,
        isExam,
      })
    })
    return parsedBlocks
  }, [schedule])

  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [day, buildDayLayout(blocks.filter((block) => block.day === day))]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks],
  )
  const blockById = useMemo(
    () => new Map(blocks.map((block) => [block.blockId, block])),
    [blocks],
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
          {[8, 12, 16, 18].map((hour) => (
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
              const isExam = blockById.get(block.blockId)?.isExam ?? false
              const widthPercent = 100 / block.visibleColumnCount
              return (
                <div
                  key={block.blockId}
                  title={block.label}
                  className={`absolute rounded-[3px] border ${
                    isExam ? 'border-accent/60 bg-accent/30' : 'border-primary/50 bg-primary/25'
                  }`}
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
          {blocks.map((block) => (
            <li
              key={block.blockId}
              className="flex flex-wrap items-baseline gap-x-2 text-[12px] text-fg-mid"
            >
              <span
                className={`inline-block h-1.5 w-1.5 self-center rounded-full ${
                  block.isExam ? 'bg-accent' : 'bg-primary/70'
                }`}
              />
              <span className="font-medium text-fg">{block.label.split(' · ')[0]}</span>
              {block.room && block.room !== 'TBA' ? (
                <span className="text-fg-muted">{block.room}</span>
              ) : null}
              {block.isExam ? <span className="text-fg-muted">· Exam</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
