import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import type { Course } from '../../courses'
import { useCatalogCourses } from '../../courses'
import { useFavorites } from '../../favorites'
import { PlannerFavoritesPanel } from './PlannerFavoritesPanel'
import { PlannerFeedback } from './PlannerFeedback'
import { balanceSemesterPlan } from '../api'
import { SemesterCompletionDialog } from './SemesterCompletionDialog'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks, type PlannerBlock } from '../utils/plannerFeedback'
import { formatSemesterLabelShort } from '../utils/semesterLabels'
import { getPlannerCourseAreaOptions, getSuggestedPlannerAssignment } from '../utils/plannerAssignments'
import { useTranscript } from '../../transcript'

const START_HOUR = 8
const END_HOUR = 20
const MINUTES_PER_HOUR = 60
const PIXELS_PER_HOUR = 56
const MAX_VISIBLE_OVERLAP_COLUMNS = 3

interface PositionedPlannerBlock extends PlannerBlock {
  columnIndex: number
  visibleColumnCount: number
  overlapGroupKey: string
}

interface OverflowIndicator {
  overlapGroupKey: string
  day: (typeof DAY_ORDER)[number]
  top: number
  hiddenBlocks: PlannerBlock[]
}

interface PlannerOverflowState {
  title: string
  blocks: PlannerBlock[]
}

function TrashIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M3 6h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path
        d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

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

function buildDayLayout(dayBlocks: PlannerBlock[]): {
  visibleBlocks: PositionedPlannerBlock[]
  overflowIndicators: OverflowIndicator[]
} {
  if (dayBlocks.length === 0) {
    return { visibleBlocks: [], overflowIndicators: [] }
  }

  const sortedBlocks = [...dayBlocks].sort(
    (left, right) => left.startMinutes - right.startMinutes || left.endMinutes - right.endMinutes,
  )
  const clusters: PlannerBlock[][] = []

  sortedBlocks.forEach((block) => {
    const currentCluster = clusters.at(-1)
    if (!currentCluster) {
      clusters.push([block])
      return
    }

    const currentClusterEnd = Math.max(...currentCluster.map((candidate) => candidate.endMinutes))
    if (block.startMinutes < currentClusterEnd) {
      currentCluster.push(block)
      return
    }

    clusters.push([block])
  })

  const visibleBlocks: PositionedPlannerBlock[] = []
  const overflowIndicators: OverflowIndicator[] = []

  clusters.forEach((cluster, clusterIndex) => {
    const columnEndMinutes: number[] = []
    const positionedClusterBlocks: Array<PlannerBlock & { columnIndex: number }> = []

    cluster.forEach((block) => {
      let columnIndex = columnEndMinutes.findIndex((endMinutes) => endMinutes <= block.startMinutes)
      if (columnIndex < 0) {
        columnIndex = columnEndMinutes.length
        columnEndMinutes.push(block.endMinutes)
      } else {
        columnEndMinutes[columnIndex] = block.endMinutes
      }

      positionedClusterBlocks.push({ ...block, columnIndex })
    })

    const visibleColumnCount = Math.min(columnEndMinutes.length, MAX_VISIBLE_OVERLAP_COLUMNS)
    const hiddenBlocks = positionedClusterBlocks.filter(
      (block) => block.columnIndex >= MAX_VISIBLE_OVERLAP_COLUMNS,
    )
    const overlapGroupKey = `${cluster[0].day}-${cluster[0].startMinutes}-${clusterIndex}`

    positionedClusterBlocks
      .filter((block) => block.columnIndex < MAX_VISIBLE_OVERLAP_COLUMNS)
      .forEach((block) => {
        visibleBlocks.push({
          ...block,
          visibleColumnCount,
          overlapGroupKey,
        })
      })

    if (hiddenBlocks.length > 0) {
      overflowIndicators.push({
        overlapGroupKey,
        day: cluster[0].day,
        top:
          ((Math.min(...cluster.map((block) => block.startMinutes)) - START_HOUR * MINUTES_PER_HOUR)
            / MINUTES_PER_HOUR)
          * PIXELS_PER_HOUR,
        hiddenBlocks,
      })
    }
  })

  return { visibleBlocks, overflowIndicators }
}

function buildBlockWidth(visibleColumnCount: number): string {
  return `calc(${100 / visibleColumnCount}% - 0.5rem)`
}

function buildBlockLeft(columnIndex: number, visibleColumnCount: number): string {
  return `calc(${(100 / visibleColumnCount) * columnIndex}% + 0.25rem)`
}

function PlannerBlockDetailDialog({
  block,
  isEditing,
  onClose,
  onRemoveSlot,
}: {
  block: PlannerBlock
  isEditing: boolean
  onClose: () => void
  onRemoveSlot: (slotId: string) => void
}) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/25" onClick={onClose}>
      <div
        className={
          isMobileViewport
            ? 'fixed inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-5 py-5'
            : 'mx-auto mt-20 w-[26rem] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-surface px-5 py-5 shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="break-words text-[15px] font-semibold text-fg">{block.courseTitle}</div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {DAY_LABELS[block.day]} · {block.label}
            </p>
            {block.room ? (
              <p className="mt-0.5 text-[12.5px] text-fg-muted">Room: {block.room}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>

        {isEditing ? (
          <button
            type="button"
            onClick={() => onRemoveSlot(block.slotId)}
            className="w-full rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            Remove this time slot
          </button>
        ) : null}
      </div>
    </div>
  )
}

function PlannerOverflowDialog({
  overflow,
  isEditing,
  onClose,
  onRemoveSlot,
}: {
  overflow: PlannerOverflowState
  isEditing: boolean
  onClose: () => void
  onRemoveSlot: (slotId: string) => void
}) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-black/20" onClick={onClose}>
      <div
        className={
          isMobileViewport
            ? 'fixed inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-5 py-5'
            : 'mx-auto mt-20 w-[28rem] max-w-[calc(100vw-2rem)] rounded-[14px] border border-border bg-surface px-5 py-5 shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-fg">Additional Overlapping Courses</div>
            <p className="mt-1 text-[12px] text-fg-muted">{overflow.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>

        <div className="grid gap-2">
          {overflow.blocks.map((block) => (
            <div
              key={block.blockId}
              className="flex items-start justify-between gap-3 rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-fg">{block.courseTitle}</div>
                <div className="text-[12px] text-fg-muted">{block.label}</div>
                <div className="text-[12px] text-fg-muted">{block.room}</div>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  onClick={() => onRemoveSlot(block.slotId)}
                  aria-label={`Remove ${block.courseTitle} from this time slot`}
                  className="rounded-md border border-border p-2 text-fg transition-colors hover:bg-surface-hover"
                >
                  <TrashIcon />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlannerWeeklyListView({
  plannedCourses,
  hiddenSlotIds,
  isEditing,
  onRemoveSlot,
}: {
  plannedCourses: Course[]
  hiddenSlotIds: string[]
  isEditing: boolean
  onRemoveSlot: (slotId: string) => void
}) {
  const blocks = useMemo(
    () => buildPlannerBlocks(plannedCourses).filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [hiddenSlotIds, plannedCourses],
  )

  return (
    <div className="grid min-w-0 gap-3">
      {DAY_ORDER.map((day) => {
        const dayBlocks = blocks.filter((block) => block.day === day)
        return (
          <div
            key={day}
            className="min-w-0 overflow-hidden rounded-[10px] border border-border-light bg-surface-hover/25 px-3 py-4 sm:px-4"
          >
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              {DAY_LABELS[day]}
            </div>
            {dayBlocks.length === 0 ? (
              <div className="text-[12.5px] text-fg-muted">No planned courses for this day.</div>
            ) : (
              <div className="grid gap-2">
                {dayBlocks.map((block) => (
                  <div
                    key={block.blockId}
                    className={`min-w-0 overflow-hidden rounded-[10px] border px-3 py-3 text-[12px] ${
                      block.hasOverlap
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-surface text-fg'
                    }`}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-semibold leading-5">{block.courseTitle}</div>
                        <div className="break-words text-[11.5px] opacity-85">{block.label}</div>
                        <div className="break-words text-[11.5px] opacity-85">{block.room}</div>
                      </div>
                      {isEditing ? (
                        <button
                          type="button"
                          onClick={() => onRemoveSlot(block.slotId)}
                          aria-label={`Remove ${block.courseTitle} from this time slot`}
                          className="shrink-0 rounded-md border border-border p-2 text-fg transition-colors hover:bg-surface-hover"
                        >
                          <TrashIcon />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MobilePlannerFavoritesDrawer({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}) {
  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[18px] border-t border-border bg-surface px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-fg">Import Courses</div>
            <div className="text-[12px] text-fg-muted">Add favorite courses to this semester plan</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md border border-border px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PlannerGrid({
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
  onOpenFavorites,
  onDropCourse,
  onRemoveSlot,
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
  onOpenFavorites: () => void
  onDropCourse: (courseId: string, areaCode: string | null) => void
  onRemoveSlot: (slotId: string) => void
}) {
  const blocks = useMemo(
    () => buildPlannerBlocks(plannedCourses).filter((block) => !hiddenSlotIds.includes(block.slotId)),
    [hiddenSlotIds, plannedCourses],
  )
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
                    onClick={() => void onDelete()}
                    disabled={isDeletingSemesterPlan || (savedCourseCount === 0 && plannedCourses.length === 0)}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingSemesterPlan ? 'Removing...' : 'Delete saved plan'}
                  </button>
                  {isMobilePlanner ? (
                    <button
                      type="button"
                      onClick={onOpenFavorites}
                      className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
                    >
                      Import
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onSave()}
                    disabled={isSavingSemesterPlan || isDeletingSemesterPlan || isLoadingSemesterPlan}
                    className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingSemesterPlan ? 'Saving...' : 'Save semester'}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelEditing}
                    disabled={isSavingSemesterPlan}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onStartEditing}
                    disabled={isLoadingSemesterPlan}
                    className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Edit semester
                  </button>
                  <button
                    type="button"
                    onClick={onOpenCompletionDialog}
                    disabled={!canCompleteSemester || isLoadingSemesterPlan || isDeletingSemesterPlan}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Mark as completed
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDelete()}
                    disabled={isDeletingSemesterPlan || (savedCourseCount === 0 && plannedCourses.length === 0)}
                    className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeletingSemesterPlan ? 'Removing...' : 'Delete saved plan'}
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
                                <TrashIcon />
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

export function SemesterPlanner() {
  const { isAuthenticated, token, user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { completedCourses, completedCoursesError, clearCompletedCoursesError } = useTranscript()
  const isSmallViewport = useMediaQuery('(max-width: 768px)')
  const [isMobileFavoritesOpen, setIsMobileFavoritesOpen] = useState<boolean>(false)
  const [isBalancingAssignments, setIsBalancingAssignments] = useState<boolean>(false)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState<boolean>(false)
  const [completionNotice, setCompletionNotice] = useState<string | null>(null)
  const { courses, isLoading, error } = useCatalogCourses('', 500)
  const {
    regulationVersion,
    regulationVersionError,
  } = useRegulationVersion(user?.profile.regulationVersionCode)
  const {
    activeSemesterLabel,
    semesterOptions,
    plannedCourseIds,
    hiddenSlotIds,
    planAssignments,
    savedPlan,
    isEditing,
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    isDeletingSemesterPlan,
    plannerError,
    hasUnsavedChanges,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    setHiddenSlotIds,
    setAssignment,
    setAssignments,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  } = useSemesterPlanner()

  const plannerMobileLayout = user?.profile.plannerMobileLayout ?? 'weekly-list'
  const isMobilePlanner = isSmallViewport
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const plannedCourses = plannedCourseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is Course => course !== undefined)
  const allPlannerBlocks = useMemo(() => buildPlannerBlocks(plannedCourses), [plannedCourses])
  const plannerStudyProgramCode = user?.profile.studyProgramCode ?? null
  const plannerRuleGroups = useMemo(
    () => regulationVersion?.ruleGroups ?? [],
    [regulationVersion?.ruleGroups],
  )
  // Show every favorited course in the planner. Courses that cannot be mapped to a
  // regulation area for the selected study program are rendered dimmed (see
  // PlannerFavoritesPanel) instead of being hidden, so favorites never silently disappear.
  const favoriteCourses = useMemo(
    () => courses.filter((course) => favoriteIds.includes(course.id)),
    [courses, favoriteIds],
  )

  function resolveAddAssignment(courseId: string, preferredAreaCode: string | null): string | null {
    const course = courseById.get(courseId)
    if (!course) {
      return null
    }

    const options = getPlannerCourseAreaOptions(course, plannerStudyProgramCode, plannerRuleGroups)
    if (preferredAreaCode && options.some((option) => option.code === preferredAreaCode)) {
      return preferredAreaCode
    }

    return getSuggestedPlannerAssignment(course, {
      studyProgramCode: plannerStudyProgramCode,
      regulationRuleGroups: plannerRuleGroups,
      planAssignments,
      plannedCourses,
      completedCourses,
    })
  }

  function clearHiddenSlotsForCourse(courseId: string): void {
    setHiddenSlotIds(
      hiddenSlotIds.filter((slotId) => !slotId.startsWith(`${courseId}:`)),
    )
  }

  function handleAddCourse(courseId: string, preferredAreaCode: string | null = null): void {
    if (!plannedCourseIds.includes(courseId)) {
      setPlannedCourseIds([...plannedCourseIds, courseId])
    }
    clearHiddenSlotsForCourse(courseId)
    setAssignment(courseId, resolveAddAssignment(courseId, preferredAreaCode))
  }

  function handleRemoveCourse(courseId: string): void {
    setPlannedCourseIds(
      plannedCourseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
    )
    clearHiddenSlotsForCourse(courseId)
    setAssignment(courseId, null)
  }

  function handleRemoveSlot(slotId: string): void {
    const slotToRemove = allPlannerBlocks.find((block) => block.slotId === slotId)
    if (!slotToRemove) {
      return
    }

    const courseSlotIds = allPlannerBlocks
      .filter((block) => block.courseId === slotToRemove.courseId)
      .map((block) => block.slotId)
    const nextHiddenSlotIds = [...new Set([...hiddenSlotIds, slotId])]

    if (courseSlotIds.length > 0 && courseSlotIds.every((courseSlotId) => nextHiddenSlotIds.includes(courseSlotId))) {
      handleRemoveCourse(slotToRemove.courseId)
      return
    }

    setHiddenSlotIds(nextHiddenSlotIds)
  }

  async function handleAutoBalanceAssignments(): Promise<void> {
    if (!token) {
      setBalanceMessage('Sign in to auto-balance planner areas.')
      return
    }
    if (plannedCourseIds.length === 0) {
      setBalanceMessage('Add courses before auto-balancing planner areas.')
      return
    }

    setIsBalancingAssignments(true)
    setBalanceMessage(null)
    try {
      const result = await balanceSemesterPlan(token, activeSemesterLabel, {
        courseIds: plannedCourseIds,
        courseAssignments: planAssignments,
      })
      setAssignments(result.assignments)
      if (result.strictSolutionFound && result.warnings.length === 0) {
        setBalanceMessage(null)
        return
      }
      const warningText = result.warnings.at(0)?.message
      setBalanceMessage(warningText || 'No complete capacity-safe composition could be found.')
    } catch (error) {
      setBalanceMessage(error instanceof Error ? error.message : 'Auto-balancing failed.')
    } finally {
      setIsBalancingAssignments(false)
    }
  }

  useEffect(() => {
    if (!isEditing || !user) {
      return
    }

    plannedCourses.forEach((course) => {
      const options = getPlannerCourseAreaOptions(course, plannerStudyProgramCode, plannerRuleGroups)
      const currentAssignment = planAssignments[course.id] ?? null
      const nextAssignment = options.length === 0
        ? null
        : getSuggestedPlannerAssignment(course, {
            studyProgramCode: plannerStudyProgramCode,
            regulationRuleGroups: plannerRuleGroups,
            planAssignments,
            plannedCourses,
            completedCourses,
          })

      const currentIsValid = Boolean(
        currentAssignment && options.some((option) => option.code === currentAssignment),
      )
      if (currentIsValid || currentAssignment === nextAssignment) {
        return
      }
      setAssignment(course.id, nextAssignment)
    })
  }, [
    completedCourses,
    isEditing,
    planAssignments,
    plannedCourses,
    plannerRuleGroups,
    plannerStudyProgramCode,
    setAssignment,
    user,
  ])

  if (!isAuthenticated || !user) {
    return (
      <div className="min-w-0 p-4 sm:p-8">
        <div className="mb-6">
          <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
            Semester Planner
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            Build and save your personal weekly semester plan.
          </p>
        </div>
        <PersonalFeatureNotice
          title="Planning is account-based"
          description="Your weekly semester plan belongs to your account. Sign in to drag favorite courses into a personal plan and save the result per semester."
        />
      </div>
    )
  }

  return (
    <div className="min-w-0 p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Semester Planner
        </h1>
        <p className="text-[13.5px] text-fg-muted">
          Plan the selected semester in a fixed weekly view.
        </p>
      </div>

      {plannerError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {plannerError}
        </div>
      ) : null}

      {regulationVersionError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {regulationVersionError}
        </div>
      ) : null}

      {completedCoursesError ? (
        <div className="mb-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
          {completedCoursesError}
        </div>
      ) : null}

      {completionNotice ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg">
          {completionNotice}
        </div>
      ) : null}

      <div className={`mt-4.5 grid min-w-0 items-start gap-4.5 ${!isMobilePlanner ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <div className="grid min-w-0 gap-4.5">
          {isLoadingSemesterPlan && !savedPlan && plannedCourseIds.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
              Loading your saved plan for {activeSemesterLabel}...
            </div>
          ) : (
            <PlannerGrid
              plannedCourses={plannedCourses}
              activeSemesterLabel={activeSemesterLabel}
              semesterOptions={semesterOptions}
              isEditing={isEditing}
              isMobilePlanner={isMobilePlanner}
              mobileLayout={plannerMobileLayout}
              hiddenSlotIds={hiddenSlotIds}
              isLoadingSemesterPlan={isLoadingSemesterPlan}
              isSavingSemesterPlan={isSavingSemesterPlan}
              isDeletingSemesterPlan={isDeletingSemesterPlan}
              savedCourseCount={savedPlan?.courseCount ?? 0}
              hasUnsavedChanges={hasUnsavedChanges}
              canCompleteSemester={plannedCourses.length > 0}
              onSelectSemester={setActiveSemesterLabel}
              onStartEditing={startEditing}
              onSave={saveCurrentSemesterPlan}
              onCancelEditing={cancelEditing}
              onDelete={deleteCurrentSemesterPlan}
              onOpenCompletionDialog={() => {
                clearCompletedCoursesError()
                setCompletionNotice(null)
                setIsCompletionDialogOpen(true)
              }}
              onOpenFavorites={() => setIsMobileFavoritesOpen(true)}
              onDropCourse={handleAddCourse}
              onRemoveSlot={handleRemoveSlot}
            />
          )}
          <PlannerFeedback
            plannedCourses={plannedCourses}
            completedCourses={completedCourses}
            studyProgramCode={plannerStudyProgramCode}
            planAssignments={planAssignments}
            regulationRuleGroups={plannerRuleGroups}
            isEditing={isEditing}
            isBalancing={isBalancingAssignments}
            balanceMessage={balanceMessage}
            onSetAssignment={setAssignment}
            onAutoBalance={handleAutoBalanceAssignments}
          />
        </div>

        {!isMobilePlanner ? (
          <PlannerFavoritesPanel
            favoriteCourses={favoriteCourses}
            plannedCourseIds={plannedCourseIds}
            activeSemesterLabel={activeSemesterLabel}
            isEditing={isEditing}
            isLoading={isLoading}
            error={error}
            studyProgramCode={plannerStudyProgramCode}
            regulationRuleGroups={plannerRuleGroups}
            planAssignments={planAssignments}
            plannedCourses={plannedCourses}
            completedCourses={completedCourses}
            onSetAssignment={setAssignment}
            onAddCourse={handleAddCourse}
            onRemoveCourse={handleRemoveCourse}
            onToggleFavorite={toggleFavorite}
          />
        ) : null}
      </div>

      <MobilePlannerFavoritesDrawer
        isOpen={isEditing && isMobilePlanner && isMobileFavoritesOpen}
        onClose={() => setIsMobileFavoritesOpen(false)}
      >
        <PlannerFavoritesPanel
          favoriteCourses={favoriteCourses}
          plannedCourseIds={plannedCourseIds}
          activeSemesterLabel={activeSemesterLabel}
          isEditing={isEditing}
          isLoading={isLoading}
          error={error}
          studyProgramCode={plannerStudyProgramCode}
          regulationRuleGroups={plannerRuleGroups}
          planAssignments={planAssignments}
          plannedCourses={plannedCourses}
          completedCourses={completedCourses}
          onSetAssignment={setAssignment}
          onAddCourse={handleAddCourse}
          onRemoveCourse={handleRemoveCourse}
          onToggleFavorite={toggleFavorite}
        />
      </MobilePlannerFavoritesDrawer>

      {!isEditing && isCompletionDialogOpen ? (
        <SemesterCompletionDialog
          semesterLabel={activeSemesterLabel}
          plannedCourses={plannedCourses}
          planAssignments={planAssignments}
          studyProgramCode={plannerStudyProgramCode}
          regulationRuleGroups={plannerRuleGroups}
          onClose={() => setIsCompletionDialogOpen(false)}
          onSuccess={(message) => {
            setCompletionNotice(message)
            setIsCompletionDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
