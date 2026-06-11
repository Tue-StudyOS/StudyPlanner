import { useMemo, useState } from 'react'
import type { Course } from '../../courses'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks, type PlannerBlock } from '../utils/plannerFeedback'
import {
  END_HOUR,
  MINUTES_PER_HOUR,
  PIXELS_PER_HOUR,
  START_HOUR,
  buildBlockLeft,
  buildBlockWidth,
  buildDayLayout,
} from '../utils/plannerDayLayout'
import { formatSemesterLabelShort } from '../utils/semesterLabels'
import { TrashIcon } from '../../../shared/components/icons'
import {
  PlannerBlockDetailDialog,
  PlannerOverflowDialog,
  type PlannerOverflowState,
} from './PlannerDialogs'
import { PlannerWeeklyListView } from './PlannerWeeklyListView'

function EmptyGridState({ isEditing }: { isEditing: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
      <div className="rounded-[10px] border border-dashed border-border bg-surface px-5 py-4 text-[13px] text-fg-muted">
        {isEditing
          ? 'Drag a favorite course into this fixed weekly grid to plan the selected semester.'
          : 'No courses are saved for this semester yet. Use Edit semester to start planning.'}
      </div>
    </div>
  )
}

function UnsavedPlannerDraftIndicator() {
  return (
    <span className="rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary">
      Unsaved semester draft
    </span>
  )
}

export function PlannerGrid({
  plannedCourses,
  activeSemesterLabel,
  semesterOptions,
  isEditing,
  isMobilePlanner,
  mobileLayout,
  hiddenSlotIds,
  isLoadingSemesterPlan,
  isSavingSemesterPlan,
  isDeletingSemesterPlan,
  savedCourseCount,
  hasUnsavedChanges,
  canCompleteSemester,
  onSelectSemester,
  onStartEditing,
  onSave,
  onCancelEditing,
  onDelete,
  onOpenCompletionDialog,
  onDropCourse,
  onRemoveSlot,
  onRemoveCourse,
}: {
  plannedCourses: Course[]
  activeSemesterLabel: string
  semesterOptions: string[]
  isEditing: boolean
  isMobilePlanner: boolean
  mobileLayout: 'compact-grid' | 'weekly-list'
  hiddenSlotIds: string[]
  isLoadingSemesterPlan: boolean
  isSavingSemesterPlan: boolean
  isDeletingSemesterPlan: boolean
  savedCourseCount: number
  hasUnsavedChanges: boolean
  canCompleteSemester: boolean
  onSelectSemester: (semesterLabel: string) => void
  onStartEditing: () => void
  onSave: () => Promise<void>
  onCancelEditing: () => void
  onDelete: () => Promise<void>
  onOpenCompletionDialog: () => void
  onDropCourse: (courseId: string, areaCode: string | null) => void
  onRemoveSlot: (slotId: string) => void
  onRemoveCourse: (courseId: string) => void
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
  const [activeBlock, setActiveBlock] = useState<PlannerBlock | null>(null)
  const isWeeklyListLayout = isMobilePlanner && mobileLayout === 'weekly-list'
  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR
  const dayLayouts = useMemo(
    () =>
      Object.fromEntries(
        DAY_ORDER.map((day) => [day, buildDayLayout(blocks.filter((block) => block.day === day))]),
      ) as Record<(typeof DAY_ORDER)[number], ReturnType<typeof buildDayLayout>>,
    [blocks],
  )

  return (
    <>
      <div
        className="rounded-[10px] border border-border bg-surface px-4 py-5 sm:px-6 sm:py-5.5"
        onDragOver={(event) => {
          if (isEditing) {
            event.preventDefault()
          }
        }}
        onDrop={(event) => {
          if (!isEditing || isWeeklyListLayout) {
            return
          }
          event.preventDefault()
          const courseId = event.dataTransfer.getData('text/planner-course-id')
          const areaCode = event.dataTransfer.getData('text/planner-area-code') || null
          if (courseId) {
            onDropCourse(courseId, areaCode)
          }
        }}
      >
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[14px] font-semibold text-fg">Weekly Schedule</div>
              {hasUnsavedChanges ? <UnsavedPlannerDraftIndicator /> : null}
            </div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Plan the selected semester here and keep only the schedule details that matter.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <div className="flex items-center gap-2 sm:min-w-[13rem]">
              <span className="text-[12px] font-semibold text-fg-muted">Semester</span>
              <select
                aria-label="Select semester"
                value={activeSemesterLabel}
                onChange={(event) => onSelectSemester(event.target.value)}
                className="rounded-[10px] border border-border bg-surface px-4 py-2.5 text-[13px] text-fg outline-none transition-colors focus:border-primary"
              >
                {semesterOptions.map((semesterLabel) => (
                  <option key={semesterLabel} value={semesterLabel}>
                    {formatSemesterLabelShort(semesterLabel)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={isSavingSemesterPlan || isDeletingSemesterPlan || isLoadingSemesterPlan}
                    className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingSemesterPlan ? 'Saving...' : 'Save semester'}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditing}
                    disabled={isSavingSemesterPlan}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={isDeletingSemesterPlan || (savedCourseCount === 0 && plannedCourses.length === 0)}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingSemesterPlan ? 'Deleting...' : 'Delete saved plan'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onStartEditing}
                    disabled={isLoadingSemesterPlan}
                    className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit semester
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={isDeletingSemesterPlan || (savedCourseCount === 0 && plannedCourses.length === 0)}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingSemesterPlan ? 'Deleting...' : 'Delete saved plan'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {isWeeklyListLayout ? (
          <PlannerWeeklyListView
            plannedCourses={plannedCourses}
            hiddenSlotIds={hiddenSlotIds}
            isEditing={isEditing}
            onRemoveSlot={onRemoveSlot}
          />
        ) : (
          <div>
            <div className={`grid ${isMobilePlanner ? 'grid-cols-[42px_repeat(5,minmax(0,1fr))] gap-1' : 'grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2'}`}>
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
                    className="absolute left-0 text-[10px] text-fg-muted sm:text-[11px]"
                    style={{ top: `${index * PIXELS_PER_HOUR - 8}px` }}
                  >
                    {String(START_HOUR + index).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              <div className="col-span-5 grid grid-cols-5 gap-1.5 sm:gap-2">
                {DAY_ORDER.map((day) => (
                  <div
                    key={day}
                    className="relative overflow-hidden rounded-lg border border-border-light bg-surface-hover/25"
                    style={{ height: `${totalHeight}px` }}
                  >
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                      <div
                        key={`${day}-${index}`}
                        className="absolute inset-x-0 border-t border-border-light/70"
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
                          onClick={() => setActiveBlock(block)}
                          aria-label={`Show details for ${block.courseTitle}`}
                          className={`absolute overflow-hidden rounded-[7px] border px-0.5 py-0.5 text-left text-[7.5px] shadow-sm transition-colors hover:brightness-105 focus:outline-none focus:ring-1 focus:ring-primary sm:px-2 sm:py-1 sm:text-[11px] ${
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
                          <div className="flex h-full items-start justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[8px] font-semibold leading-tight sm:text-[11px]">
                                {block.courseTitle}
                              </div>
                              <div className="truncate text-[7px] opacity-80 sm:text-[10px]">{block.room}</div>
                            </div>
                            {isEditing ? (
                              <span
                                role="button"
                                tabIndex={0}
                                aria-label={`Remove ${block.courseTitle} from this time slot`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onRemoveSlot(block.slotId)
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onRemoveSlot(block.slotId)
                                  }
                                }}
                                className="rounded-sm p-0.5 opacity-70 hover:bg-surface-hover hover:opacity-100 sm:p-1"
                              >
                                <TrashIcon size={14} />
                              </span>
                            ) : null}
                          </div>
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

                    {isEditing && dayLayouts[day].visibleBlocks.length === 0 && dayLayouts[day].overflowIndicators.length === 0 ? (
                      <EmptyGridState isEditing={true} />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {unscheduledPlannedCourses.length > 0 ? (
          <div className="mt-4 rounded-[10px] border border-border-light bg-surface-hover/25 px-4 py-3">
            <div className="text-[12.5px] font-semibold text-fg">Unscheduled planned courses</div>
            <p className="mt-1 text-[11.5px] text-fg-muted">
              These courses are in this semester plan but do not have a concrete weekday/time yet.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {unscheduledPlannedCourses.map((course) => (
                <div
                  key={course.id}
                  className="flex min-w-0 items-start justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="break-words text-[12px] font-semibold text-fg">{course.title}</div>
                    <div className="text-[11.5px] text-fg-muted">
                      {course.number} · {course.ects ?? 'unknown'} ECTS
                    </div>
                  </div>
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => onRemoveCourse(course.id)}
                      aria-label={`Remove ${course.title} from semester plan`}
                      className="shrink-0 rounded-md border border-border p-2 text-fg transition-colors hover:bg-surface-hover"
                    >
                      <TrashIcon size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!isEditing && canCompleteSemester ? (
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
                disabled={isLoadingSemesterPlan || isDeletingSemesterPlan}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                Complete semester
              </button>
            </div>
          </div>
        ) : null}

        {!isEditing && plannedCourses.length === 0 ? (
          <div className="mt-4 rounded-[10px] border border-dashed border-border px-5 py-4 text-center text-[13px] text-fg-muted">
            No courses are saved for this semester yet. Use Edit semester to start planning.
          </div>
        ) : null}
      </div>

      {activeOverflow ? (
        <PlannerOverflowDialog
          overflow={activeOverflow}
          isEditing={isEditing}
          onClose={() => setActiveOverflow(null)}
          onRemoveSlot={(slotId) => {
            onRemoveSlot(slotId)
            setActiveOverflow((currentValue) => {
              if (!currentValue) {
                return currentValue
              }
              const remainingBlocks = currentValue.blocks.filter((block) => block.slotId !== slotId)
              return remainingBlocks.length > 0
                ? {
                    ...currentValue,
                    blocks: remainingBlocks,
                  }
                : null
            })
          }}
        />
      ) : null}

      {activeBlock ? (
        <PlannerBlockDetailDialog
          block={activeBlock}
          isEditing={isEditing}
          onClose={() => setActiveBlock(null)}
          onRemoveSlot={(slotId) => {
            onRemoveSlot(slotId)
            setActiveBlock(null)
          }}
        />
      ) : null}
    </>
  )
}
