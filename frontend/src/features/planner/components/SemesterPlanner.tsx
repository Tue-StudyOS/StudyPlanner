import { useEffect, useMemo, useState } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import type { Course } from '../../courses'
import { findCatalogPeriodForSemesterLabel, useCatalogCourses, useCatalogPeriods } from '../../courses'
import { useFavorites } from '../../favorites'
import { PlannerFavoritesPanel } from './PlannerFavoritesPanel'
import { PlannerFeedback } from './PlannerFeedback'
import { balanceSemesterPlan } from '../api'
import { SemesterCompletionDialog } from './SemesterCompletionDialog'
import { PlannerGrid } from './PlannerGrid'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import { buildPlannerBlocks } from '../utils/plannerFeedback'
import { getPlannerCourseAreaOptions } from '../utils/plannerAssignments'
import {
  getPlannerFavoritesLayout,
  PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY,
} from '../utils/favoritesLayout.ts'
import { useTranscript } from '../../transcript'

export function SemesterPlanner() {
  const { isAuthenticated, token, user } = useAuth()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { completedCourses, completedCoursesError, clearCompletedCoursesError } = useTranscript()
  const isSmallViewport = useMediaQuery('(max-width: 768px)')
  const hasSidebarSpace = useMediaQuery(PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY)
  const [isBalancingAssignments, setIsBalancingAssignments] = useState<boolean>(false)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState<boolean>(false)
  const [completionNotice, setCompletionNotice] = useState<string | null>(null)
  const {
    regulationVersion,
    isLoadingRegulationVersion,
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

  // Load the catalog of the semester being planned so the weekly grid uses that
  // semester's appointments. Falls back to the newest period (backend default)
  // when the catalog has no data for the selected semester.
  const { periods } = useCatalogPeriods()
  const activePeriodId = useMemo(
    () => findCatalogPeriodForSemesterLabel(periods, activeSemesterLabel)?.periodId,
    [periods, activeSemesterLabel],
  )
  const { courses, isLoading, error } = useCatalogCourses('', 500, activePeriodId)

  const plannerMobileLayout = user?.profile.plannerMobileLayout ?? 'weekly-list'
  const isMobilePlanner = isSmallViewport
  const favoritesLayout = getPlannerFavoritesLayout(hasSidebarSpace)
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

  function resolveExplicitAddAssignment(courseId: string, preferredAreaCode: string | null): string | null {
    const course = courseById.get(courseId)
    if (!course) {
      return null
    }

    const options = getPlannerCourseAreaOptions(course, plannerStudyProgramCode, plannerRuleGroups)
    if (preferredAreaCode && options.some((option) => option.code === preferredAreaCode)) {
      return preferredAreaCode
    }
    return null
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
    setAssignment(courseId, resolveExplicitAddAssignment(courseId, preferredAreaCode))
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
      if (!currentAssignment) {
        return
      }
      const currentIsValid = Boolean(
        currentAssignment && options.some((option) => option.code === currentAssignment),
      )
      if (!currentIsValid) {
        setAssignment(course.id, null)
      }
    })
  }, [
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

  const plannerFavoritesPanel = (
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
  )

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

      <div className="mt-4.5 grid min-w-0 gap-4.5">
        <div
          className={`grid min-w-0 items-start gap-4.5 ${
            favoritesLayout === 'sidebar' ? 'min-[1100px]:grid-cols-[minmax(0,1fr)_20rem]' : ''
          }`}
        >
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
                onDropCourse={handleAddCourse}
                onRemoveSlot={handleRemoveSlot}
                onRemoveCourse={handleRemoveCourse}
              />
            )}
          </div>

          {plannerFavoritesPanel}
        </div>

        <PlannerFeedback
          plannedCourses={plannedCourses}
          completedCourses={completedCourses}
          studyProgramCode={plannerStudyProgramCode}
          planAssignments={planAssignments}
          regulationRuleGroups={plannerRuleGroups}
          isLoadingRegulationVersion={isLoadingRegulationVersion}
          isEditing={isEditing}
          isBalancing={isBalancingAssignments}
          balanceMessage={balanceMessage}
          onSetAssignments={setAssignments}
          onRemoveCourse={handleRemoveCourse}
          onAutoBalance={handleAutoBalanceAssignments}
        />
      </div>


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
