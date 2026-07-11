import { useMemo } from 'react'
import { useTranslation } from '../../i18n'
import {
  getTutorialSlotOptions,
  resolveVisibleTutorialSlotId,
} from '../../planner/utils/plannerSlotSelection.ts'
import type { Course, ScheduleSlot } from '../types.ts'
import {
  buildExamDisplayEntries,
  buildScheduleSlotSecondaryDetails,
  formatCancellationDates,
  partitionCourseSchedule,
  type IndexedScheduleSlot,
} from '../utils/courseSchedule.ts'
import { WeeklyScheduleMiniGrid } from './WeeklyScheduleMiniGrid.tsx'

export interface TutorialSelectionProps {
  hiddenSlotIds: readonly string[]
  onSelect: (slotId: string) => void
}

function hasPublishedValue(value: string | null | undefined): value is string {
  return Boolean(value?.trim()) && value?.trim().toLowerCase() !== 'tba'
}

function SlotDetails({ slot }: { slot: ScheduleSlot }) {
  const { t, language } = useTranslation()
  const secondary = buildScheduleSlotSecondaryDetails(slot)
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium text-fg">{slot.day}</span>
        <span className="tabular-nums text-fg-mid">{slot.time}</span>
        {hasPublishedValue(slot.room) ? (
          <span className="min-w-0 break-words text-fg-muted">{slot.room}</span>
        ) : null}
      </div>
      {secondary.length > 0 ? (
        <div className="mt-0.5 break-words text-[11px] leading-relaxed text-fg-muted">
          {secondary.join(' · ')}
        </div>
      ) : null}
      {(slot.cancellationDates?.length ?? 0) > 0 ? (
        <div className="mt-0.5 break-words text-[11px] text-amber-600 dark:text-amber-400">
          {t('courseDetail.cancellationDates', {
            dates: formatCancellationDates(slot.cancellationDates ?? [], language),
          })}
        </div>
      ) : null}
    </div>
  )
}

function SessionList({ entries }: { entries: readonly IndexedScheduleSlot[] }) {
  return (
    <div className="grid gap-1.5">
      {entries.map(({ slot, index }) => (
        <div
          key={`${slot.id ?? `${slot.day}-${slot.time}`}-${index}`}
          className="min-w-0 rounded-lg border border-border-light bg-surface-hover/20 px-3 py-2 text-[12px]"
        >
          <SlotDetails slot={slot} />
        </div>
      ))}
    </div>
  )
}

export function CourseScheduleDetails({
  course,
  tutorialSelection,
}: {
  course: Course
  tutorialSelection?: TutorialSelectionProps
}) {
  const { t } = useTranslation()
  const parts = useMemo(() => partitionCourseSchedule(course.schedule), [course.schedule])
  const tutorialOptions = useMemo(() => getTutorialSlotOptions(course), [course])
  const selectedTutorialSlotId = tutorialSelection
    ? resolveVisibleTutorialSlotId(tutorialOptions, tutorialSelection.hiddenSlotIds)
    : null
  const exams = useMemo(
    () => buildExamDisplayEntries(parts.examAppointments, course.exams),
    [course.exams, parts.examAppointments],
  )
  const hasWeeklySessions = parts.recurringSessions.length > 0 || parts.tutorialOptions.length > 0

  return (
    <div className="grid min-w-0 gap-4">
      <WeeklyScheduleMiniGrid schedule={course.schedule} />

      {!hasWeeklySessions ? (
        <div className="text-[12px] text-fg-muted">{t('courseDetail.noWeeklyTimes')}</div>
      ) : null}

      {parts.recurringSessions.length > 0 ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
            {t('courseDetail.recurringSessions')}
          </div>
          <SessionList entries={parts.recurringSessions} />
        </div>
      ) : null}

      {parts.tutorialOptions.length > 0 ? (
        <div className="grid min-w-0 gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
              {t('courseDetail.tutorialOptions')}
            </div>
            <span className="text-[11px] text-fg-muted">
              {t('courseDetail.optionCount', { count: parts.tutorialOptions.length })}
            </span>
          </div>
          <div className="grid min-w-0 gap-1.5 sm:grid-cols-2">
            {parts.tutorialOptions.map((entry, optionIndex) => {
              const option = tutorialOptions[optionIndex]
              const isSelected = Boolean(option && option.slotId === selectedTutorialSlotId)
              const className = `min-w-0 rounded-lg border px-3 py-2 text-left text-[12px] transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/10'
                  : 'border-border-light bg-surface-hover/20'
              }`
              return tutorialSelection && option ? (
                <button
                  key={option.slotId}
                  type="button"
                  onClick={() => tutorialSelection.onSelect(option.slotId)}
                  aria-pressed={isSelected}
                  className={`${className} hover:border-primary/40`}
                >
                  <SlotDetails slot={entry.slot} />
                </button>
              ) : (
                <div key={`${entry.slot.id ?? optionIndex}`} className={className}>
                  <SlotDetails slot={entry.slot} />
                </div>
              )
            })}
          </div>
          {tutorialSelection && parts.tutorialOptions.length > 1 ? (
            <div className="text-[11px] leading-relaxed text-fg-muted">
              {t('courseDetail.tutorialSelectionHint')}
            </div>
          ) : null}
        </div>
      ) : null}

      {exams.length > 0 ? (
        <div className="grid gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
            {t('courseDetail.examDates')}
          </div>
          <div className="grid gap-1.5">
            {exams.map((exam) => (
              <div
                key={exam.key}
                className="min-w-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12px]"
              >
                <div className="font-medium text-fg">{exam.type}</div>
                <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-fg-mid">
                  <span>{exam.date}</span>
                  {exam.time ? <span>{exam.time}</span> : null}
                  {hasPublishedValue(exam.room) ? <span className="break-words">{exam.room}</span> : null}
                  {hasPublishedValue(exam.duration) ? <span>{exam.duration}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {parts.otherAppointments.length > 0 ? (
        <details className="min-w-0 rounded-lg border border-border-light bg-surface-hover/15 px-3 py-2.5">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">
            {t('courseDetail.otherAppointments')} ({parts.otherAppointments.length})
          </summary>
          <div className="mt-2">
            <SessionList entries={parts.otherAppointments} />
          </div>
        </details>
      ) : null}
    </div>
  )
}
