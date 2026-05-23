import { useMemo } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useAuth } from '../../auth'
import type { Course } from '../../courses'
import { useCatalogCourses } from '../../courses'
import { useFavorites } from '../../favorites'
import { PlannerFavoritesPanel } from './PlannerFavoritesPanel'
import { PlannerFeedback } from './PlannerFeedback'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import { DAY_LABELS, DAY_ORDER, buildPlannerBlocks } from '../utils/plannerFeedback'

const START_HOUR = 8
const END_HOUR = 20
const MINUTES_PER_HOUR = 60
const PIXELS_PER_HOUR = 56

function EmptyGridState({ isEditing }: { isEditing: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
      <div className="rounded-[10px] border border-dashed border-border bg-surface px-5 py-4 text-[13px] text-fg-muted">
        {isEditing
          ? 'Drag a favorite course into this grid to place its scheduled blocks in your weekly plan.'
          : 'No courses are saved for this semester yet. Use Edit plan to start building one.'}
      </div>
    </div>
  )
}

function PlannerGrid({
  plannedCourses,
  isEditing,
  onDropCourse,
  onRemoveCourse,
}: {
  plannedCourses: Course[]
  isEditing: boolean
  onDropCourse: (courseId: string) => void
  onRemoveCourse: (courseId: string) => void
}) {
  const blocks = useMemo(() => buildPlannerBlocks(plannedCourses), [plannedCourses])
  const totalHeight = (END_HOUR - START_HOUR) * PIXELS_PER_HOUR

  return (
    <div
      className="rounded-[10px] border border-border bg-surface px-6 py-5.5"
      onDragOver={(event) => {
        if (isEditing) {
          event.preventDefault()
        }
      }}
      onDrop={(event) => {
        if (!isEditing) {
          return
        }
        event.preventDefault()
        const courseId = event.dataTransfer.getData('text/planner-course-id')
        if (courseId) {
          onDropCourse(courseId)
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[14px] font-semibold text-fg">Weekly schedule</div>
          <p className="text-[12.5px] text-fg-muted">
            {isEditing
              ? 'Drag favorites into the grid or use the side panel buttons.'
              : 'Saved weekly view for the selected semester.'}
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-surface-hover/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          {isEditing ? 'Planning mode' : 'Saved view'}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-2">
          <div />
          {DAY_ORDER.map((day) => (
            <div
              key={day}
              className="text-center text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted"
            >
              {DAY_LABELS[day]}
            </div>
          ))}

          <div className="relative h-full">
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
              <div
                key={index}
                className="absolute left-0 text-[11px] text-fg-muted"
                style={{ top: `${index * PIXELS_PER_HOUR - 8}px` }}
              >
                {String(START_HOUR + index).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="col-span-5 grid grid-cols-5 gap-2">
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

                {blocks
                  .filter((block) => block.day === day)
                  .map((block) => {
                    const top =
                      ((block.startMinutes - START_HOUR * MINUTES_PER_HOUR) / MINUTES_PER_HOUR) *
                      PIXELS_PER_HOUR
                    const height =
                      ((block.endMinutes - block.startMinutes) / MINUTES_PER_HOUR) *
                      PIXELS_PER_HOUR
                    return (
                      <div
                        key={block.blockId}
                        className={`absolute inset-x-1 rounded-md border px-2 py-1 text-[11px] shadow-sm ${
                          block.hasOverlap
                            ? 'border-primary bg-primary-soft text-primary'
                            : 'border-border bg-surface text-fg dark:bg-surface-hover'
                        }`}
                        style={{ top: `${top}px`, height: `${Math.max(height, 34)}px` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{block.courseTitle}</div>
                            <div className="truncate text-[10px] opacity-80">{block.label}</div>
                            <div className="truncate text-[10px] opacity-80">{block.room}</div>
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
                        {block.hasOverlap ? (
                          <div className="mt-1 text-[10px] font-semibold">Overlap</div>
                        ) : null}
                      </div>
                    )
                  })}

                {blocks.length === 0 ? <EmptyGridState isEditing={isEditing} /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function SemesterPlanner() {
  const { isAuthenticated, user } = useAuth()
  const { favoriteIds } = useFavorites()
  const { courses, isLoading, error } = useCatalogCourses('')
  const {
    activeSemesterLabel,
    semesterOptions,
    plannedCourseIds,
    planAssignments,
    savedPlan,
    isEditing,
    isLoadingPlanIndex,
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    isDeletingSemesterPlan,
    plannerError,
    plannerMessage,
    hasUnsavedChanges,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    setAssignment,
    startEditing,
    cancelEditing,
    saveCurrentSemesterPlan,
    deleteCurrentSemesterPlan,
  } = useSemesterPlanner()

  if (!isAuthenticated) {
    return (
      <div className="p-8">
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

  const favoriteCourses = courses.filter((course) => favoriteIds.includes(course.id))
  const courseById = new Map(courses.map((course) => [course.id, course]))
  const plannedCourses = plannedCourseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is Course => course !== undefined)

  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap gap-2">
          <div className="inline-flex rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Account-based planning
          </div>
          <div className="inline-flex rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            One plan per semester
          </div>
        </div>
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Semester Planner
        </h1>
        <p className="text-[13.5px] text-fg-muted">
          Switch semesters and save one weekly plan per semester. Planning mode reveals your
          favorites.
        </p>
      </div>

      <section className="mb-4.5 rounded-[10px] border border-border bg-surface px-6 py-5.5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-1.5 sm:max-w-[260px]">
            <label
              htmlFor="planner-semester"
              className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted"
            >
              Active semester
            </label>
            <select
              id="planner-semester"
              value={activeSemesterLabel}
              onChange={(event) => setActiveSemesterLabel(event.target.value)}
              className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors focus:border-primary"
            >
              {semesterOptions.map((semesterLabel) => (
                <option key={semesterLabel} value={semesterLabel}>
                  {semesterLabel}
                </option>
              ))}
            </select>
            <p className="text-[12px] text-fg-muted">
              {user?.profile.currentSemesterLabel
                ? `Default from your profile: ${user.profile.currentSemesterLabel}`
                : 'Set your current semester in Account to change the default planner view.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={() => void saveCurrentSemesterPlan()}
                  disabled={
                    isSavingSemesterPlan || isDeletingSemesterPlan || isLoadingSemesterPlan
                  }
                  className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingSemesterPlan ? 'Saving...' : `Save ${activeSemesterLabel}`}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={isSavingSemesterPlan}
                  className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel editing
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startEditing}
                disabled={isLoadingSemesterPlan}
                className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                Edit plan
              </button>
            )}
            <button
              type="button"
              onClick={() => void deleteCurrentSemesterPlan()}
              disabled={
                isDeletingSemesterPlan || (!savedPlan && plannedCourseIds.length === 0)
              }
              className="rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeletingSemesterPlan ? 'Removing...' : 'Delete saved plan'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-[12.5px] text-fg-muted">
          <span>
            {savedPlan
              ? `Saved ${savedPlan.courseCount} course(s) for ${activeSemesterLabel}.`
              : `No saved plan yet for ${activeSemesterLabel}.`}
          </span>
          <span>
            {isLoadingPlanIndex
              ? 'Loading saved semesters...'
              : `${semesterOptions.length} semester option(s) available.`}
          </span>
          {hasUnsavedChanges ? (
            <span className="text-primary">You have unsaved changes.</span>
          ) : null}
        </div>
      </section>

      {plannerMessage ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-mid">
          {plannerMessage}
        </div>
      ) : null}

      {plannerError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {plannerError}
        </div>
      ) : null}

      <div className="grid gap-4.5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4.5">
          {isLoadingSemesterPlan && !savedPlan && plannedCourseIds.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
              Loading your saved plan for {activeSemesterLabel}...
            </div>
          ) : (
            <PlannerGrid
              plannedCourses={plannedCourses}
              isEditing={isEditing}
              onDropCourse={(courseId) =>
                setPlannedCourseIds(
                  plannedCourseIds.includes(courseId)
                    ? plannedCourseIds
                    : [...plannedCourseIds, courseId],
                )
              }
              onRemoveCourse={(courseId) =>
                setPlannedCourseIds(
                  plannedCourseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
                )
              }
            />
          )}

          {isEditing ? (
            <PlannerFavoritesPanel
              favoriteCourses={favoriteCourses}
              plannedCourseIds={plannedCourseIds}
              activeSemesterLabel={activeSemesterLabel}
              isLoading={isLoading}
              error={error}
              onAddCourse={(courseId) =>
                setPlannedCourseIds(
                  plannedCourseIds.includes(courseId)
                    ? plannedCourseIds
                    : [...plannedCourseIds, courseId],
                )
              }
              onRemoveCourse={(courseId) =>
                setPlannedCourseIds(
                  plannedCourseIds.filter((plannedCourseId) => plannedCourseId !== courseId),
                )
              }
            />
          ) : null}
        </div>

        <PlannerFeedback
          plannedCourses={plannedCourses}
          studyProgramCode={user?.profile.studyProgramCode ?? null}
          planAssignments={planAssignments}
          isEditing={isEditing}
          onSetAssignment={setAssignment}
        />
      </div>
    </div>
  )
}
