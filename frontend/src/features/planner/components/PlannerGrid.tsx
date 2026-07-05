import { useMemo, useState } from 'react'
import { RemoveIcon } from '../../../shared/components/icons'
import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import { scheduleSlotBlockClasses, scheduleSlotListLabelClasses } from '../../courses/utils/scheduleSlotKind.ts'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks } from '../utils/plannerFeedback'
import type { ManualPlannerSlot } from '../types.ts'
import {
  END_HOUR,
  MAX_VISIBLE_OVERLAP_COLUMNS,
  MINUTES_PER_HOUR,
  PIXELS_PER_HOUR,
  START_HOUR,
  buildBlockLeft,
  buildBlockWidth,
  buildDayLayout,
} from '../utils/plannerDayLayout'
import { getBlockTitleLineClamp } from '../utils/plannerBlockText.ts'
import { assignCourseNumbers, getCourseColor } from '../utils/courseBadge.ts'
import { useTheme } from '../../theme'
import { PlannerOverflowDialog, type PlannerOverflowState } from './PlannerDialogs'

export type PlannerRenderMode = 'name' | 'badge'

// Narrow phone columns cannot fit three side-by-side blocks legibly, so mobile
// shows fewer overlap columns (the rest collapse into the "+n" dialog) and uses
// a tighter gutter to keep each visible block as wide as possible.
const MOBILE_MAX_OVERLAP_COLUMNS = 2
const MOBILE_BLOCK_GAP_REM = 0.25
const DESKTOP_BLOCK_GAP_REM = 0.5

function ExportCalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
      <path
        d="M3 13h10"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
      <path
        d="M8 11V4.5M5.5 7L8 4.5 10.5 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

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
  manualSlots = [],
  isMobilePlanner,
  canCompleteSemester,
  activeSemesterLabel,
  isLoadingSemesterPlan,
  renderMode = 'name',
  readOnly = false,
  onDropCourse = () => {},
  onRemoveCourse,
  onOpenCourse,
  onRequestAdd = () => {},
  onRequestManualSlot = () => {},
  onOpenCompletionDialog = () => {},
  onExportCalendar,
  exportCalendarTitle = 'Export calendar',
}: {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  manualSlots?: ManualPlannerSlot[]
  isMobilePlanner: boolean
  canCompleteSemester: boolean
  activeSemesterLabel: string
  isLoadingSemesterPlan: boolean
  renderMode?: PlannerRenderMode
  readOnly?: boolean
  onDropCourse?: (courseId: string, areaCode: string | null) => void
  onRemoveCourse?: (courseId: string) => void
  onOpenCourse: (courseId: string) => void
  onRequestAdd?: () => void
  onRequestManualSlot?: () => void
  onOpenCompletionDialog?: () => void
  onExportCalendar?: () => void
  exportCalendarTitle?: string
}) {
  const isBadge = renderMode === 'badge'
  const { isDark } = useTheme()
  const badgeTextColor = isDark ? '#1a1a1a' : '#ffffff'
  const courseNumbers = useMemo(
    () => assignCourseNumbers(plannedCourses.map((course) => course.id)),
    [plannedCourses],
  )
  const blocks = useMemo(
    () => buildPlannerBlocks(plannedCourses, manualSlots).filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [hiddenSlotIds, manualSlots, plannedCourses],
  )
  const unscheduledPlannedCourses = useMemo(() => {
    const scheduledCourseIds = new Set(blocks.map((block) => block.courseId))
    return plannedCourses.filter((course) => !scheduledCourseIds.has(course.id))
  }, [blocks, plannedCourses])
  const [activeOverflow, setActiveOverflow] = useState<PlannerOverflowState | null>(null)
  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR
  const maxVisibleColumns = isMobilePlanner ? MOBILE_MAX_OVERLAP_COLUMNS : MAX_VISIBLE_OVERLAP_COLUMNS
  const blockGapRem = isMobilePlanner ? MOBILE_BLOCK_GAP_REM : DESKTOP_BLOCK_GAP_REM
  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [
          day,
          buildDayLayout(blocks.filter((block) => block.day === day), maxVisibleColumns),
        ]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks, maxVisibleColumns],
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
        className="rounded-[10px] border border-border bg-surface px-2 py-3 sm:px-4 sm:py-5.5"
        onDragOver={readOnly ? undefined : (event) => event.preventDefault()}
        onDrop={readOnly ? undefined : (event) => {
          event.preventDefault()
          const courseId = event.dataTransfer.getData('text/planner-course-id')
          const areaCode = event.dataTransfer.getData('text/planner-area-code') || null
          if (courseId) {
            onDropCourse(courseId, areaCode)
          }
        }}
      >
        {!readOnly ? (
          <div className="mb-2 flex justify-end gap-1 px-0.5 sm:px-0">
            <button
              type="button"
              onClick={onRequestManualSlot}
              title="Add manual time slot"
              aria-label="Add manual time slot"
              className="inline-flex h-8 items-center gap-1 rounded-md border border-transparent px-2 text-[12px] font-medium text-fg-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-fg"
            >
              <span aria-hidden="true" className="text-[15px] leading-none">+</span>
              <span className="hidden sm:inline">Slot</span>
            </button>
            {onExportCalendar ? (
              <button
                type="button"
                data-tour="planner-export"
                onClick={onExportCalendar}
                disabled={plannedCourses.length === 0}
                title={exportCalendarTitle}
                aria-label={exportCalendarTitle}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-fg-muted transition-colors hover:border-border hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ExportCalendarIcon />
              </button>
            ) : null}
          </div>
        ) : null}
        <div
          data-tour="planner-grid"
          className={`grid ${isMobilePlanner ? 'grid-cols-[1.25rem_repeat(5,minmax(0,1fr))] gap-1' : 'grid-cols-[42px_repeat(5,minmax(0,1fr))] gap-2'}`}
        >
          <div />
          {DAY_ORDER.map((day) => (
            <div
              key={day}
              className="text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted sm:text-[13px]"
            >
              {DAY_LABELS[day]}
            </div>
          ))}

          <div className="relative h-full">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
              <div
                key={index}
                className="absolute right-0 -translate-y-1/2 text-right text-[10px] tabular-nums leading-none text-fg-muted sm:right-0.5 sm:text-[12px]"
                style={{ top: `${index * PIXELS_PER_HOUR}px` }}
              >
                {`${String(START_HOUR + index).padStart(2, '0')}:00`}
              </div>
            ))}
          </div>

          <div className="col-span-5 grid grid-cols-5 gap-1.5 sm:gap-2">
            {DAY_ORDER.map((day) => (
              <div
                key={day}
                onClick={isMobilePlanner && !readOnly ? handleEmptyAreaClick : undefined}
                className="relative overflow-hidden rounded-lg border border-border-light bg-surface-hover/25"
                style={{ height: `${totalHeight}px` }}
              >
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
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
                  const height = Math.max(
                    ((block.endMinutes - block.startMinutes) / MINUTES_PER_HOUR)
                    * PIXELS_PER_HOUR,
                    44,
                  )
                  const titleLineClamp = getBlockTitleLineClamp(
                    height,
                    isMobilePlanner,
                    Boolean(block.slotType),
                  )
                  const badgeColor = isBadge && block.slotKind === 'weekly' ? getCourseColor(block.courseId) : null
                  const showBadgeNumber = isBadge && (badgeColor || block.slotKind !== 'weekly')
                  const courseNumber = courseNumbers.get(block.courseId)
                  return (
                    <div
                      key={block.blockId}
                      className="absolute"
                      style={{
                        top: `${top}px`,
                        left: buildBlockLeft(block.columnIndex, block.visibleColumnCount, blockGapRem),
                        width: buildBlockWidth(block.visibleColumnCount, blockGapRem),
                        height: `${height}px`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenCourse(block.courseId)}
                        aria-label={`Show details for ${block.courseTitle}`}
                        title={block.courseTitle}
                        className={`h-full w-full overflow-hidden rounded-[7px] border px-1 py-0.5 text-left shadow-sm transition-[filter] hover:brightness-105 focus:outline-none focus:ring-1 focus:ring-primary sm:px-2 sm:py-1 ${
                          isBadge && block.slotKind === 'weekly'
                            ? block.hasOverlap
                              ? 'border-primary/70'
                              : 'border-black/10 dark:border-white/15'
                            : scheduleSlotBlockClasses(block.slotKind, block.hasOverlap)
                        }`}
                        style={{
                          ...(badgeColor ? { backgroundColor: badgeColor } : {}),
                        }}
                      >
                        {showBadgeNumber ? (
                          <div className="flex h-full w-full items-center justify-center">
                            <span
                              className="text-[13px] font-bold tabular-nums sm:text-[15px]"
                              style={{
                                color: block.slotKind === 'weekly' ? badgeTextColor : undefined,
                              }}
                            >
                              {courseNumber}
                            </span>
                          </div>
                        ) : (
                          <>
                            <div
                              className="text-[10px] font-semibold leading-[13px] [hyphens:none] [overflow-wrap:normal] [word-break:normal] sm:text-[12px] sm:leading-[15px]"
                              style={{
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: titleLineClamp,
                                overflow: 'hidden',
                              }}
                            >
                              {block.courseTitle}
                            </div>
                          {block.slotType && (block.slotKind === 'exam' || block.slotKind === 'resit') ? (
                            <div className={`truncate text-[9px] leading-[11px] sm:text-[10px] ${scheduleSlotListLabelClasses(block.slotKind)}`}>
                              {block.slotType}
                            </div>
                          ) : null}
                          </>
                        )}
                      </button>
                      {onRemoveCourse && !readOnly ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onRemoveCourse(block.courseId)
                          }}
                          aria-label={`Remove ${block.courseTitle} from semester plan`}
                          title="Remove from plan"
                          className="absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center text-fg-muted opacity-75 transition-opacity hover:opacity-100 hover:text-primary sm:h-5 sm:w-5"
                        >
                          <RemoveIcon size={10} />
                        </button>
                      ) : null}
                    </div>
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

                {plannedCourses.length === 0 && !isLoadingSemesterPlan && !readOnly ? (
                  <EmptyDayHint isMobilePlanner={isMobilePlanner} />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {isBadge && plannedCourses.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            {plannedCourses.map((course) => {
              const legendColor = getCourseColor(course.id)
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onOpenCourse(course.id)}
                  className="flex min-w-0 items-center gap-2 text-left"
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold tabular-nums"
                    style={{ backgroundColor: legendColor, color: badgeTextColor }}
                  >
                    {courseNumbers.get(course.id)}
                  </span>
                  <span className="min-w-0 truncate text-[12px] text-fg">
                    {cleanCourseTitle(course.title, course.number)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}

        {unscheduledPlannedCourses.length > 0 ? (
          <div className="mt-4 rounded-[10px] border border-border-light bg-surface-hover/25 px-4 py-3">
            <div className="text-[12.5px] font-semibold text-fg">Without weekly time</div>
            <p className="mt-1 text-[11.5px] text-fg-muted">
              These planned courses have no concrete weekday yet — add a manual slot with + Slot.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
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
              {!readOnly ? (
                <button
                  type="button"
                  onClick={onRequestManualSlot}
                  className="inline-flex min-h-[2.75rem] items-center justify-center rounded-md border border-dashed border-border px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5"
                >
                  + Add slot
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {canCompleteSemester && !readOnly ? (
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
