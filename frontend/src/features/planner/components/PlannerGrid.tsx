import { useMemo, useState } from 'react'
import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks } from '../utils/plannerFeedback'
import {
  END_HOUR,
  MINUTES_PER_HOUR,
  PIXELS_PER_HOUR,
  START_HOUR,
  buildBlockLeft,
  buildBlockWidth,
  buildDayLayout,
} from '../utils/plannerDayLayout'
import { PlannerOverflowDialog, type PlannerOverflowState } from './PlannerDialogs'

function EmptyDayHint({ isMobilePlanner }: { isMobilePlanner: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-2 text-center">
      <div className="text-[10px] leading-relaxed text-fg-muted sm:text-[11px]">
        {isMobilePlanner ? 'Tap to add courses.' : 'Drag interested courses here.'}
      </div>
    </div>
  )
}

export function PlannerGrid({
  plannedCourses,
  hiddenSlotIds,
  isMobilePlanner,
  canCompleteSemester,
  activeSemesterLabel,
  isLoadingSemesterPlan,
  onDropCourse,
  onOpenCourse,
  onRequestAdd,
  onOpenCompletionDialog,
}: {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  isMobilePlanner: boolean
  canCompleteSemester: boolean
  activeSemesterLabel: string
  isLoadingSemesterPlan: boolean
  onDropCourse: (courseId: string, areaCode: string | null) => void
  onOpenCourse: (courseId: string) => void
  onRequestAdd: () => void
  onOpenCompletionDialog: () => void
}) {
  const blocks = useMemo(
    () => buildPlannerBlocks(plannedCourses).filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [hiddenSlotIds, plannedCourses],
  )
  const unscheduledPlannedCourses = useMemo(() => {
    const scheduledCourseIds = new Set(blocks.map((block) => block.courseId))
    return plannedCourses.filter((course) => !scheduledCourseIds.has(course.id))
  }, [blocks, plannedCourses])
  const [activeOverflow, setActiveOverflow] = useState<PlannerOverflowState | null>(null)
  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR
  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [day, buildDayLayout(blocks.filter((block) => block.day === day))]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks],
  )

  function handleEmptyAreaClick(event: React.MouseEvent<HTMLDivElement>): void {
    // Only direct taps on the empty column background open the add flow;
    // taps on course blocks are handled by the blocks themselves.
    if (event.target === event.currentTarget) {
      onRequestAdd()
    }
  }

  return (
    <>
      <div
        className="rounded-[10px] border border-border bg-surface px-2 py-3 sm:px-6 sm:py-5.5"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const courseId = event.dataTransfer.getData('text/planner-course-id')
          const areaCode = event.dataTransfer.getData('text/planner-area-code') || null
          if (courseId) {
            onDropCourse(courseId, areaCode)
          }
        }}
      >
        <div className={`grid ${isMobilePlanner ? 'grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1' : 'grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2'}`}>
          <div />
          {DAY_ORDER.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted sm:text-[12px]"
            >
              {DAY_LABELS[day]}
            </div>
          ))}

          <div className="relative h-full">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
              <div
                key={index}
                className="absolute right-0.5 text-right text-[9px] tabular-nums text-fg-muted sm:right-1 sm:text-[11px]"
                style={{ top: `${index * PIXELS_PER_HOUR - 8}px` }}
              >
                {isMobilePlanner
                  ? String(START_HOUR + index)
                  : `${String(START_HOUR + index).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          <div className="col-span-5 grid grid-cols-5 gap-1.5 sm:gap-2">
            {DAY_ORDER.map((day) => (
              <div
                key={day}
                onClick={isMobilePlanner ? handleEmptyAreaClick : undefined}
                className="relative overflow-hidden rounded-lg border border-border-light bg-surface-hover/25"
                style={{ height: `${totalHeight}px` }}
              >
                {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                  <div
                    key={`${day}-${index}`}
                    className="pointer-events-none absolute inset-x-0 border-t border-border-light/70"
                    style={{ top: `${index * PIXELS_PER_HOUR}px` }}
                  />
                ))}

                {dayLayouts[day].visibleBlocks.map((block) => {
                  const top =
                    ((block.startMinutes - START_HOUR * MINUTES_PER_HOUR) / MINUTES_PER_HOUR)
                    * PIXELS_PER_HOUR
                  const height =
                    ((block.endMinutes - block.startMinutes) / MINUTES_PER_HOUR)
                    * PIXELS_PER_HOUR
                  return (
                    <button
                      key={block.blockId}
                      type="button"
                      onClick={() => onOpenCourse(block.courseId)}
                      aria-label={`Show details for ${block.courseTitle}`}
                      className={`absolute overflow-hidden rounded-[7px] border px-1 py-0.5 text-left shadow-sm transition-colors hover:brightness-105 focus:outline-none focus:ring-1 focus:ring-primary sm:px-2 sm:py-1 ${
                        block.hasOverlap
                          ? 'border-primary/40 bg-primary/10 text-primary'
                          : 'border-border bg-surface text-fg dark:bg-surface-hover'
                      }`}
                      style={{
                        top: `${top}px`,
                        left: buildBlockLeft(block.columnIndex, block.visibleColumnCount),
                        width: buildBlockWidth(block.visibleColumnCount),
                        height: `${Math.max(height, 38)}px`,
                      }}
                    >
                      <div className="line-clamp-3 break-words text-[8px] font-semibold leading-[1.2] [hyphens:auto] sm:line-clamp-2 sm:text-[11px] sm:leading-tight">
                        {block.courseTitle}
                      </div>
                      {block.slotType ? (
                        <div className="hidden truncate text-[10px] opacity-75 sm:block">
                          {block.slotType}
                        </div>
                      ) : null}
                    </button>
                  )
                })}

                {dayLayouts[day].overflowIndicators.map((indicator) => (
                  <button
                    key={indicator.overlapGroupKey}
                    type="button"
                    onClick={() =>
                      setActiveOverflow({
                        title: `${DAY_LABELS[indicator.day]} · ${indicator.hiddenBlocks[0]?.label ?? 'Overlap'}`,
                        blocks: indicator.hiddenBlocks,
                      })
                    }
                    className="absolute right-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-1 text-[9px] font-semibold text-primary shadow-sm sm:px-2 sm:text-[10px]"
                    style={{ top: `${indicator.top + 4}px` }}
                  >
                    +{indicator.hiddenBlocks.length}
                  </button>
                ))}

                {plannedCourses.length === 0 && !isLoadingSemesterPlan ? (
                  <EmptyDayHint isMobilePlanner={isMobilePlanner} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {unscheduledPlannedCourses.length > 0 ? (
          <div className="mt-4 rounded-[10px] border border-border-light bg-surface-hover/25 px-4 py-3">
            <div className="text-[12.5px] font-semibold text-fg">Without weekly time</div>
            <p className="mt-1 text-[11.5px] text-fg-muted">
              These planned courses have no concrete weekday yet — tap one for details.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {unscheduledPlannedCourses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onOpenCourse(course.id)}
                  className="min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-primary/30"
                >
                  <div className="break-words text-[12px] font-semibold text-fg">
                    {cleanCourseTitle(course.title, course.number)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {canCompleteSemester ? (
          <div className="mt-4 rounded-[10px] border border-border-light bg-surface-hover/20 px-4 py-3.5">
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-fg">Finish this semester</div>
                <p className="mt-1 max-w-[34rem] text-[11.5px] text-fg-muted">
                  Move the planned courses from {activeSemesterLabel} into your completed-course history.
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenCompletionDialog}
                disabled={isLoadingSemesterPlan}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Complete semester
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {activeOverflow ? (
        <PlannerOverflowDialog
          overflow={activeOverflow}
          onClose={() => setActiveOverflow(null)}
          onOpenCourse={(courseId) => {
            setActiveOverflow(null)
            onOpenCourse(courseId)
          }}
        />
      ) : null}
    </>
  )
}
