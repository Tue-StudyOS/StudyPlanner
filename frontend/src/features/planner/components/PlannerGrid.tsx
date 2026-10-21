import { useMemo, useState } from 'react'
import { RemoveIcon } from '../../../shared/components/icons'
import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import type { ManualPlannerSlot } from '../types.ts'
import { markPlannerBlockOverlaps } from '../utils/plannerFeedback.ts'
import { buildPlannerWeek } from '../utils/plannerCalendar.ts'
import { addCalendarDays, formatCalendarDate, initialCalendarWeek, localCalendarDate, parseCalendarDate, startOfCalendarWeek } from '../utils/plannerDates.ts'
import { getLecturePeriod } from '../utils/lecturePeriod.ts'
import { PlannerWeekView } from './PlannerWeekView.tsx'

interface Props {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  manualSlots?: ManualPlannerSlot[]
  isMobilePlanner: boolean
  canCompleteSemester: boolean
  activeSemesterLabel: string
  isLoadingSemesterPlan: boolean
  isPastSemester?: boolean
  isTourPreview?: boolean
  onDropCourse?: (courseId: string, areaCode: string | null) => void
  onRemoveCourse?: (courseId: string) => void
  onOpenCourse: (courseId: string) => void
  onRequestAdd?: () => void
  onRequestManualSlot?: () => void
  onOpenCompletionDialog?: () => void
  onExportCalendar?: () => void
  exportCalendarTitle?: string
}

export function PlannerGrid({
  plannedCourses, hiddenSlotIds, manualSlots = [], isMobilePlanner, canCompleteSemester,
  activeSemesterLabel, isLoadingSemesterPlan, isPastSemester = false, isTourPreview = false,
  onDropCourse = () => {}, onRemoveCourse, onOpenCourse, onRequestAdd = () => {},
  onRequestManualSlot = () => {}, onOpenCompletionDialog = () => {}, onExportCalendar,
  exportCalendarTitle = 'Export full-semester calendar',
}: Props) {
  const [navigation, setNavigation] = useState(() => ({ semester: activeSemesterLabel, week: initialCalendarWeek(activeSemesterLabel) }))
  // Reset only on semester changes, never on catalog loads or tutorial selection.
  if (navigation.semester !== activeSemesterLabel) {
    setNavigation({ semester: activeSemesterLabel, week: initialCalendarWeek(activeSemesterLabel) })
  }
  const previewPeriod = isTourPreview ? getLecturePeriod(activeSemesterLabel) : null
  const weekStart = previewPeriod ? startOfCalendarWeek(localCalendarDate(previewPeriod.start)) : navigation.week
  const calendar = useMemo(() => buildPlannerWeek({
    courses: plannedCourses, manualSlots, hiddenSlotIds, semesterLabel: activeSemesterLabel, weekStart,
  }), [plannedCourses, manualSlots, hiddenSlotIds, activeSemesterLabel, weekStart])
  const blocks = useMemo(() => markPlannerBlockOverlaps(calendar.blocks), [calendar.blocks])
  const unpublishedCourses = plannedCourses.filter((course) => !course.schedule.length && !course.exams.length && !manualSlots.some((slot) => slot.courseId === course.id))

  function navigateTo(date: string): void {
    setNavigation({ semester: activeSemesterLabel, week: startOfCalendarWeek(date) })
  }

  return (
    <div className="min-w-0 w-full max-w-full rounded-[10px] border border-border bg-surface px-2 py-3 sm:px-4 sm:py-5.5"
      onDragOver={isPastSemester ? undefined : (event) => event.preventDefault()}
      onDrop={isPastSemester ? undefined : (event) => {
        event.preventDefault()
        const courseId = event.dataTransfer.getData('text/planner-course-id')
        const areaCode = event.dataTransfer.getData('text/planner-area-code') || null
        if (courseId) onDropCourse(courseId, areaCode)
      }}>
      <div className="mb-2 flex flex-wrap justify-end gap-2">
        <button type="button" data-tour="planner-manual-slot" onClick={onRequestManualSlot} title="Add manual time slot" aria-label="Add manual time slot" className="min-h-9 rounded border border-border px-2 text-xs text-fg-muted">+ Slot</button>
        {!isPastSemester && onExportCalendar ? <button type="button" data-tour="planner-export" onClick={onExportCalendar} disabled={!plannedCourses.length} title={`${exportCalendarTitle} (full semester)`} aria-label={exportCalendarTitle} className="min-h-9 rounded border border-border px-2 text-xs text-fg-muted disabled:opacity-40">Export semester</button> : null}
      </div>
      <nav aria-label="Calendar week navigation" className="mb-4 flex min-w-0 flex-wrap items-center gap-2 text-xs text-fg">
        <h2 className="w-full break-words text-sm font-semibold" data-calendar-week={weekStart} aria-live="polite">
          {formatCalendarDate(weekStart)} – {formatCalendarDate(addCalendarDays(weekStart, 6))}
        </h2>
        {isTourPreview ? <p className="text-fg-muted">Tour preview · first teaching week</p> : <>
          <button type="button" aria-label="Previous week" onClick={() => navigateTo(addCalendarDays(weekStart, -7))} className="min-h-10 rounded border border-border px-3">← Previous</button>
          <button type="button" aria-label="Next week" onClick={() => navigateTo(addCalendarDays(weekStart, 7))} className="min-h-10 rounded border border-border px-3">Next →</button>
          <button type="button" onClick={() => navigateTo(initialCalendarWeek(activeSemesterLabel))} className="min-h-10 rounded border border-border px-3">Current / semester start</button>
          <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2">Jump to date
            <input type="date" aria-label="Jump to date" value={weekStart} onChange={(event) => {
              const date = parseCalendarDate(event.target.value)
              if (date) {
                navigateTo(date)
              }
            }} className="min-h-10 min-w-0 max-w-full rounded border border-border bg-surface px-2 text-fg" />
          </label>
        </>}
      </nav>
      <PlannerWeekView weekStart={weekStart} blocks={blocks} dateItems={calendar.dateItems}
        isMobilePlanner={isMobilePlanner}
        onOpenCourse={onOpenCourse} onRemoveCourse={isPastSemester ? undefined : onRemoveCourse} onRequestAdd={onRequestAdd} />
      {!blocks.length && !calendar.dateItems.length ? <p className="mt-3 text-sm text-fg-muted">No appointments this week. Your planned courses remain below.</p> : null}

      {plannedCourses.length > 0 ? <section aria-label="All planned courses" className="mt-4 min-w-0 rounded-lg border border-border-light p-3">
        <h3 className="text-sm font-semibold text-fg">All planned courses</h3>
        <p className="mt-1 text-xs text-fg-muted">Full semester plan · courses remain here even in empty weeks. Export includes the full semester, not just this week.</p>
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          {plannedCourses.map((course) => <div key={course.id} className="flex min-w-0 max-w-full items-start gap-1 rounded border border-border bg-surface px-2 py-2">
            <button type="button" onClick={() => onOpenCourse(course.id)} className="min-w-0 break-words text-left text-xs font-semibold text-fg">{cleanCourseTitle(course.title, course.number)}</button>
            {onRemoveCourse && !isPastSemester ? <button type="button" onClick={() => onRemoveCourse(course.id)} className="shrink-0 p-1 text-fg-muted" aria-label={`Remove ${cleanCourseTitle(course.title, course.number)} from semester plan`}><RemoveIcon size={12} /></button> : null}
          </div>)}
        </div>
        <p className="mt-2 text-xs text-fg-muted">Missing recurrence bounds and manual slots use the approximate semester teaching period. No holidays are inferred.</p>
        {calendar.unresolved.length || unpublishedCourses.length ? <details className="mt-3 text-xs text-fg-muted" open>
          <summary className="cursor-pointer font-semibold text-fg">Unresolved schedule information</summary>
          <ul className="mt-2 space-y-2 break-words">
            {calendar.unresolved.map((item) => {
              const course = plannedCourses.find((candidate) => candidate.id === item.courseId)!
              return <li key={item.id}><button type="button" onClick={() => onOpenCourse(item.courseId)} className="text-left underline">{cleanCourseTitle(course.title, course.number)}</button> · {item.label}</li>
            })}
            {unpublishedCourses.map((course) => <li key={course.id}>{cleanCourseTitle(course.title, course.number)} · No published appointments</li>)}
          </ul>
          <button type="button" onClick={onRequestManualSlot} className="mt-2 rounded border border-dashed border-border px-3 py-2 text-primary">+ Add slot</button>
        </details> : null}
      </section> : null}

      {canCompleteSemester && !isPastSemester ? <div className="mt-4 rounded-[10px] border border-border-light bg-surface-hover/20 px-4 py-3.5">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-fg">Finish this semester</div>
            <p className="mt-1 max-w-[34rem] text-[11.5px] text-fg-muted">Move the planned courses from {activeSemesterLabel} into your completed-course history.</p>
          </div>
          <button type="button" onClick={onOpenCompletionDialog} disabled={isLoadingSemesterPlan} className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg disabled:opacity-60">Complete semester</button>
        </div>
      </div> : null}
    </div>
  )
}
