import { useMemo } from 'react'
import { DAY_LABELS, DAY_ORDER } from '../../planner/utils/plannerFeedback'
import { buildDayLayout } from '../../planner/utils/plannerDayLayout'
import { useTranslation } from '../../i18n'
import { getDateOrdinal, parseDateSortValue } from '../utils/examLabels.ts'
import type { ScheduleSlotKind } from '../utils/scheduleSlotKind.ts'
import {
  buildMiniGridBlocks,
  collapseMiniGridBlocksForCalendar,
  MINI_GRID_LABEL_SEPARATOR,
} from '../utils/weeklyScheduleMiniGrid.ts'
import type { ScheduleSlot } from '../types'

const GRID_START_MINUTES = 8 * 60
const GRID_END_MINUTES = 18 * 60
const GRID_HEIGHT_PX = 108

function toPercent(minutes: number): number {
  const clamped = Math.min(Math.max(minutes, GRID_START_MINUTES), GRID_END_MINUTES)
  return ((clamped - GRID_START_MINUTES) / (GRID_END_MINUTES - GRID_START_MINUTES)) * 100
}

function getGridBlockClasses(kind: ScheduleSlotKind): string {
  if (kind === 'resit') {
    return 'border-accent/45 bg-accent/18'
  }
  if (kind === 'exam') return 'border-accent/80 bg-accent/45'
  return 'border-primary/70 bg-primary/35'
}

function getLegendSwatchClasses(kind: ScheduleSlotKind): string {
  if (kind === 'resit') {
    return 'border-accent/45 bg-accent/18'
  }
  if (kind === 'exam') return 'border-accent/80 bg-accent/45'
  return 'border-primary/70 bg-primary/35'
}

function getDotClasses(kind: ScheduleSlotKind): string {
  if (kind === 'resit') return 'bg-accent/55'
  if (kind === 'exam') return 'bg-accent'
  return 'bg-primary'
}

/**
 * Compact Mon-Fri grid marking weekly slots as primary-colored blocks and
 * one-off exam/resit dates in distinct colors. The list keeps every published
 * appointment, while the calendar collapses same-time duplicates into one block.
 */
export function WeeklyScheduleMiniGrid({ schedule }: { schedule: ScheduleSlot[] }) {
  const { t } = useTranslation()
  const blocks = useMemo(() => buildMiniGridBlocks(schedule), [schedule])
  const calendarBlocks = useMemo(() => collapseMiniGridBlocksForCalendar(blocks), [blocks])

  // The list below the grid shows weekly course times first, then the exam
  // dates in chronological order labelled Exam / Resit exam.
  const listEntries = useMemo(() => {
    const weeklyBlocks = blocks.filter((block) => block.kind === 'weekly')
    const examBlocks = blocks
      .filter((block) => block.kind !== 'weekly')
      .sort((left, right) => {
        const leftValue = parseDateSortValue(left.examDate ?? '')
        const rightValue = parseDateSortValue(right.examDate ?? '')
        if (leftValue !== null && rightValue !== null) return leftValue - rightValue
        if (leftValue !== null) return -1
        if (rightValue !== null) return 1
        return 0
      })
    const examDates = examBlocks.map((block) => block.examDate ?? '')
    return [
      ...weeklyBlocks.map((block) => ({ block, examOrdinal: null as number | null })),
      ...examBlocks.map((block, index) => ({
        block,
        examOrdinal: getDateOrdinal(examDates, index),
      })),
    ]
  }, [blocks])

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
  const blockById = useMemo(
    () => new Map(calendarBlocks.map((block) => [block.blockId, block])),
    [calendarBlocks],
  )
  const hasExam = blocks.some((block) => block.kind === 'exam')
  const hasResit = blocks.some((block) => block.kind === 'resit')

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
              const kind = blockById.get(block.blockId)?.kind ?? 'weekly'
              const widthPercent = 100 / block.visibleColumnCount
              return (
                <div
                  key={block.blockId}
                  title={block.label}
                  className={`absolute rounded-[3px] border ${getGridBlockClasses(kind)}`}
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

      {blocks.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-fg-muted">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-[2px] border ${getLegendSwatchClasses('weekly')}`} />
            {t('courseDetail.weekly')}
          </span>
          {hasExam ? (
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-[2px] border ${getLegendSwatchClasses('exam')}`} />
              {t('courseDetail.exam')}
            </span>
          ) : null}
          {hasResit ? (
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-[2px] border ${getLegendSwatchClasses('resit')}`} />
              {t('courseDetail.resitExam')}
            </span>
          ) : null}
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <div className="mt-2 text-[12px] text-fg-muted">No weekly times published yet.</div>
      ) : (
        <ul className="mt-2.5 flex flex-col gap-1">
          {listEntries.map(({ block, examOrdinal }) => (
            <li
              key={block.blockId}
              className={`flex flex-wrap items-baseline gap-x-2 text-fg-mid ${
                block.kind !== 'weekly' ? 'gap-y-0.5 text-[11px] leading-4' : 'text-[12px]'
              }`}
            >
              <span className={`inline-block h-2 w-2 self-center rounded-full ${getDotClasses(block.kind)}`} />
              <span className="font-medium text-fg">{block.label.split(MINI_GRID_LABEL_SEPARATOR)[0]}</span>
              {block.room && block.room !== 'TBA' ? (
                <span className="text-fg-muted">{block.room}</span>
              ) : null}
              {examOrdinal !== null ? (
                <span className="text-fg-muted">
                  {MINI_GRID_LABEL_SEPARATOR}
                  {block.kind === 'resit' || examOrdinal > 0
                    ? t('courseDetail.resitExam')
                    : t('courseDetail.exam')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
