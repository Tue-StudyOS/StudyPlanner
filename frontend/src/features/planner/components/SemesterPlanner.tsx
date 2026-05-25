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

function PlannerOverflowDialog({
  overflow,
  isEditing,
  onClose,
  onRemoveCourse,
}: {
  overflow: PlannerOverflowState
  isEditing: boolean
  onClose: () => void
  onRemoveCourse: (courseId: string) => void
}) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')

  return (
    <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose}>
      <div
        className={`absolute ${
          isMobileViewport
            ? 'inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-5 py-5'
            : 'left-1/2 top-20 w-[28rem] -translate-x-1/2 rounded-[14px] border border-border bg-surface px-5 py-5 shadow-2xl'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[14px] font-semibold text-fg">Additional overlapping courses</div>
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

        <div className="grid max-h-[50vh] gap-2 overflow-y-auto">
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
                  onClick={() => onRemoveCourse(block.courseId)}
                  className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium text-fg transition-colors hover:bg-surface-hover"
                >
                  Remove
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
  isEditing,
  onRemoveCourse,
}: {
  plannedCourses: Course[]
  isEditing: boolean
  onRemoveCourse: (courseId: string) => void
}) {
  const blocks = useMemo(() => buildPlannerBlocks(plannedCourses), [plannedCourses])

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
                          onClick={() => onRemoveCourse(block.courseId)}
                          className="shrink-0 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-fg transition-colors hover:bg-surface-hover"
                        >
                          Remove
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
        className="absolute inset-x-0 bottom-0 rounded-t-[18px] border-t border-border bg-surface px-4 py-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold text-fg">Favorite courses</div>
            <div className="text-[12px] text-fg-muted">Choose and assign favorites here</div>
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
  isLoadingSemesterPlan,
  isSavingSemesterPlan,
  isDeletingSemesterPlan,
  savedCourseCount,
  hasUnsavedChanges,
  onSelectSemester,
  onStartEditing,
  onSave,
  onCancelEditing,
  onDelete,
  onOpenFavorites,
  onDropCourse,
  onRemoveCourse,
}: {
  plannedCourses: Course[]
  activeSemesterLabel: string
  semesterOptions: string[]
  isEditing: boolean
  isMobilePlanner: boolean
  mobileLayout: 'compact-grid' | 'weekly-list'
  isLoadingSemesterPlan: boolean
  isSavingSemesterPlan: boolean
  isDeletingSemesterPlan: boolean
  savedCourseCount: number
  hasUnsavedChanges: boolean
  onSelectSemester: (semesterLabel: string) => void
  onStartEditing: () => void
  onSave: () => Promise<void>
  onCancelEditing: () => void
  onDelete: () => Promise<void>
  onOpenFavorites: () => void
  onDropCourse: (courseId: string, areaCode: string | null) => void
  onRemoveCourse: (courseId: string) => void
}) {
  const blocks = useMemo(() => buildPlannerBlocks(plannedCourses), [plannedCourses])
  const [activeOverflow, setActiveOverflow] = useState<PlannerOverflowState | null>(null)
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
            <div className="text-[14px] font-semibold text-fg">Weekly schedule</div>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              {isMobilePlanner
                ? mobileLayout === 'weekly-list'
                  ? 'Mobile weekly list view enabled.'
                  : 'Compact mobile weekly grid enabled.'
                : isEditing
                  ? 'Edit the selected semester directly in the weekly planner.'
                  : 'The weekly planner stays fixed while the active semester can still be switched above the grid.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <label className="grid gap-1.5 sm:min-w-[13rem]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Semester
              </span>
              <select
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
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {isEditing ? (
                <>
                  {isMobilePlanner ? (
                    <button
                      type="button"
                      onClick={onOpenFavorites}
                      className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
                    >
                      Favorites
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
                <button
                  type="button"
                  onClick={onStartEditing}
                  disabled={isLoadingSemesterPlan}
                  className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit semester
                </button>
              )}
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={isDeletingSemesterPlan || (savedCourseCount === 0 && plannedCourses.length === 0)}
                className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingSemesterPlan ? 'Removing...' : 'Delete saved plan'}
              </button>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 text-[12.5px] text-fg-muted">
          <span>
            {savedCourseCount > 0
              ? `${savedCourseCount} saved course(s) for ${formatSemesterLabelShort(activeSemesterLabel)}.`
              : `No saved plan yet for ${formatSemesterLabelShort(activeSemesterLabel)}.`}
          </span>
          {hasUnsavedChanges ? <span className="text-primary">You have unsaved changes.</span> : null}
        </div>

        {isWeeklyListLayout ? (
          <PlannerWeeklyListView
            plannedCourses={plannedCourses}
            isEditing={isEditing}
            onRemoveCourse={onRemoveCourse}
          />
        ) : (
          <div>
            <div className={`grid ${isMobilePlanner ? 'grid-cols-[48px_repeat(5,minmax(0,1fr))] gap-1.5' : 'grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2'}`}>
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
                        <div
                          key={block.blockId}
                          className={`absolute rounded-md border px-1.5 py-1 text-[10px] shadow-sm sm:px-2 sm:text-[11px] ${
                            block.hasOverlap
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border bg-surface text-fg dark:bg-surface-hover'
                          }`}
                          style={{
                            top: `${top}px`,
                            left: buildBlockLeft(block.columnIndex, block.visibleColumnCount),
                            width: buildBlockWidth(block.visibleColumnCount),
                            height: `${Math.max(height, 34)}px`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{block.courseTitle}</div>
                              <div className="truncate text-[9px] opacity-80 sm:text-[10px]">{block.label}</div>
                              <div className="truncate text-[9px] opacity-80 sm:text-[10px]">{block.room}</div>
                            </div>
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => onRemoveCourse(block.courseId)}
                                className="rounded-sm px-1 text-[10px] font-semibold opacity-70 hover:opacity-100"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
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
          onRemoveCourse={(courseId) => {
            onRemoveCourse(courseId)
            setActiveOverflow((currentValue) =>
              currentValue
                ? {
                    ...currentValue,
                    blocks: currentValue.blocks.filter((block) => block.courseId !== courseId),
                  }
                : currentValue,
            )
          }}
        />
      ) : null}
    </>
  )
}

export function SemesterPlanner() {
  const { isAuthenticated, user } = useAuth()
  const { favoriteIds } = useFavorites()
  const { completedCourses } = useTranscript()
  const isSmallViewport = useMediaQuery('(max-width: 768px)')
  const [isMobileFavoritesOpen, setIsMobileFavoritesOpen] = useState<boolean>(false)
  const { courses, isLoading, error } = useCatalogCourses('', 500)
  const {
    regulationVersion,
    regulationVersionError,
  } = useRegulationVersion(user?.profile.regulationVersionCode)
  const {
    activeSemesterLabel,
    semesterOptions,
    plannedCourseIds,
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
    setAssignment,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  } = useSemesterPlanner()

  const plannerMobileMode = user?.profile.plannerMobileMode ?? 'auto'
  const plannerMobileLayout = user?.profile.plannerMobileLayout ?? 'weekly-list'
  const isMobilePlanner = plannerMobileMode === 'mobile'
    || (plannerMobileMode === 'auto' && isSmallViewport)
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const plannedCourses = plannedCourseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is Course => course !== undefined)
  const plannerStudyProgramCode = user?.profile.studyProgramCode ?? null
  const plannerRuleGroups = useMemo(
    () => regulationVersion?.ruleGroups ?? [],
    [regulationVersion?.ruleGroups],
  )
  const favoriteCourses = useMemo(() => {
    const allFavorites = courses.filter((course) => favoriteIds.includes(course.id))
    if (plannerRuleGroups.length === 0 || !plannerStudyProgramCode) return allFavorites
    return allFavorites.filter(
      (course) => getPlannerCourseAreaOptions(course, plannerStudyProgramCode, plannerRuleGroups).length > 0,
    )
  }, [courses, favoriteIds, plannerRuleGroups, plannerStudyProgramCode])

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

  function handleAddCourse(courseId: string, preferredAreaCode: string | null = null): void {
    if (!plannedCourseIds.includes(courseId)) {
      setPlannedCourseIds([...plannedCourseIds, courseId])
    }
    setAssignment(courseId, resolveAddAssignment(courseId, preferredAreaCode))
  }

  function handleRemoveCourse(courseId: string): void {
    setPlannedCourseIds(
      plannedCourseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
    )
    setAssignment(courseId, null)
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
          {isMobilePlanner
            ? `Mobile planner active · ${plannerMobileLayout === 'weekly-list' ? 'weekly list' : 'compact weekly grid'}`
            : 'Plan the selected semester in a fixed weekly view, choose what each favorite should count as directly in the picker, and keep the layout simple on desktop and mobile.'}
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

      <PlannerFeedback
        plannedCourses={plannedCourses}
        studyProgramCode={plannerStudyProgramCode}
        planAssignments={planAssignments}
        regulationRuleGroups={plannerRuleGroups}
      />

      <div className={`mt-4.5 grid min-w-0 items-start gap-4.5 ${isEditing && !isMobilePlanner ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
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
              isLoadingSemesterPlan={isLoadingSemesterPlan}
              isSavingSemesterPlan={isSavingSemesterPlan}
              isDeletingSemesterPlan={isDeletingSemesterPlan}
              savedCourseCount={savedPlan?.courseCount ?? 0}
              hasUnsavedChanges={hasUnsavedChanges}
              onSelectSemester={setActiveSemesterLabel}
              onStartEditing={startEditing}
              onSave={saveCurrentSemesterPlan}
              onCancelEditing={cancelEditing}
              onDelete={deleteCurrentSemesterPlan}
              onOpenFavorites={() => setIsMobileFavoritesOpen(true)}
              onDropCourse={handleAddCourse}
              onRemoveCourse={handleRemoveCourse}
            />
          )}
        </div>

        {isEditing && !isMobilePlanner ? (
          <PlannerFavoritesPanel
            favoriteCourses={favoriteCourses}
            plannedCourseIds={plannedCourseIds}
            activeSemesterLabel={activeSemesterLabel}
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
        />
      </MobilePlannerFavoritesDrawer>
    </div>
  )
}
