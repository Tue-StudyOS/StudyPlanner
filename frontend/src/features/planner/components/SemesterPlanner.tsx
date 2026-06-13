import { useEffect, useMemo, useState } from 'react'
import { PageShell } from '../../../shared/components/PageShell'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { useAuth } from '../../auth'
import type { Course } from '../../courses'
import { findCatalogPeriodForSemesterLabel, useCatalogCourses, useCatalogPeriods } from '../../courses'
import { useFavorites } from '../../favorites'
import { useTranslation } from '../../i18n'
import { useOnboarding } from '../../onboarding'
import {
  buildTourPlannerPreview,
  isPlannerTourStep,
} from '../../onboarding/utils/tourPreviewData.ts'
import { useTranscript } from '../../transcript'
import { balanceSemesterPlan } from '../api'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import {
  getCurrentPlannerAssignment,
  getPlannerCourseAreaOptions,
  getSuggestedPlannerAssignment,
} from '../utils/plannerAssignments'
import { buildSemesterPlanIcs } from '../utils/icsExport.ts'
import { formatSemesterLabelShort } from '../utils/semesterLabels'
import {
  getPlannerFavoritesLayout,
  PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY,
} from '../utils/favoritesLayout.ts'
import { MobilePlannerFavoritesDrawer } from './PlannerDialogs'
import { PlannerCourseDetailModal } from './PlannerCourseDetailModal'
import { PlannerFavoritesPanel } from './PlannerFavoritesPanel'
import { PlannerFeedback } from './PlannerFeedback'
import { PlannerGrid } from './PlannerGrid'
import { PlannerProgressStrip } from './PlannerProgressStrip'
import { SemesterCompletionDialog } from './SemesterCompletionDialog'

// Auto-save is silent; only the brief in-flight state is surfaced.
function SaveIndicator({ isSaving }: { isSaving: boolean }) {
  if (!isSaving) {
    return null
  }
  return <span className="text-[11.5px] font-medium text-fg-muted">Saving…</span>
}

export function SemesterPlanner() {
  const { isAuthenticated, token, user } = useAuth()
  const { t } = useTranslation()
  const { isOpen: isOnboardingOpen, activeStepId } = useOnboarding()
  const { favoriteIds, toggleFavorite } = useFavorites()
  const { completedCourses, completedCoursesError, clearCompletedCoursesError } = useTranscript()
  const isSmallViewport = useMediaQuery('(max-width: 768px)')
  const hasSidebarSpace = useMediaQuery(PLANNER_FAVORITES_SIDEBAR_MEDIA_QUERY)
  const [isBalancingAssignments, setIsBalancingAssignments] = useState<boolean>(false)
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null)
  const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState<boolean>(false)
  const [completionNotice, setCompletionNotice] = useState<string | null>(null)
  const [openCourseId, setOpenCourseId] = useState<string | null>(null)
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState<boolean>(false)
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
    isLoadingSemesterPlan,
    isSavingSemesterPlan,
    plannerError,
    setActiveSemesterLabel,
    setPlannedCourseIds,
    setHiddenSlotIds,
    setAssignment,
    setAssignments,
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

  const favoritesLayout = getPlannerFavoritesLayout(hasSidebarSpace)
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses])
  const plannedCourses = plannedCourseIds
    .map((courseId) => courseById.get(courseId))
    .filter((course): course is Course => course !== undefined)
  const plannerStudyProgramCode = user?.profile.studyProgramCode ?? null
  const plannerRuleGroups = useMemo(
    () => regulationVersion?.ruleGroups ?? [],
    [regulationVersion?.ruleGroups],
  )
  // Show every interested course in the planner. Courses that cannot be mapped
  // to a regulation area are rendered dimmed instead of hidden, so they never
  // silently disappear.
  const favoriteCourses = useMemo(
    () => courses.filter((course) => favoriteIds.includes(course.id)),
    [courses, favoriteIds],
  )
  const isPlannerTourPreview = isOnboardingOpen && isPlannerTourStep(activeStepId)
  const shouldShowTourAddDrawer = isSmallViewport && isOnboardingOpen && activeStepId === 'planner-add-mobile'
  const isPlannerMobileInterestedTour = shouldShowTourAddDrawer && isPlannerTourPreview
  const plannerTourPreview = useMemo(
    () => buildTourPlannerPreview(plannerRuleGroups, plannerStudyProgramCode),
    [plannerRuleGroups, plannerStudyProgramCode],
  )
  const displayPlannedCourses = isPlannerTourPreview ? plannerTourPreview.plannedCourses : plannedCourses
  const displayPlannedCourseIds = isPlannerTourPreview
    ? plannerTourPreview.plannedCourses.map((course) => course.id)
    : plannedCourseIds
  const displayFavoriteCourses = isPlannerTourPreview ? plannerTourPreview.favoriteCourses : favoriteCourses
  const displayCompletedCourses = isPlannerTourPreview ? plannerTourPreview.completedCourses : completedCourses
  const displayPlanAssignments = isPlannerTourPreview ? plannerTourPreview.assignments : planAssignments
  const displayHiddenSlotIds = isPlannerTourPreview ? [] : hiddenSlotIds
  const displayRuleGroups = isPlannerTourPreview ? plannerTourPreview.ruleGroups : plannerRuleGroups
  const displayStudyProgramCode = plannerStudyProgramCode
  const displayCourseById = useMemo(
    () => new Map(
      (isPlannerTourPreview ? [...displayPlannedCourses, ...displayFavoriteCourses] : courses)
        .map((course) => [course.id, course]),
    ),
    [courses, displayFavoriteCourses, displayPlannedCourses, isPlannerTourPreview],
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

  function handleInterestedCourseAdd(courseId: string, areaCode: string | null): void {
    if (isPlannerTourPreview) {
      return
    }
    handleAddCourse(courseId, areaCode)
    if (isSmallViewport) {
      setIsAddDrawerOpen(false)
    }
  }

  function handleExportIcs(): void {
    const icsContent = buildSemesterPlanIcs({
      semesterLabel: activeSemesterLabel,
      courses: plannedCourses,
      hiddenSlotIds,
    })
    if (!icsContent) {
      return
    }
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `studyplanner-${activeSemesterLabel.replace(/[\s/]+/g, '-')}.ics`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleAutoBalanceAssignments(): Promise<void> {
    if (!token) {
      setBalanceMessage(t('planner.signInToBalance'))
      return
    }
    if (plannedCourseIds.length === 0) {
      setBalanceMessage(t('planner.addBeforeBalance'))
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
      setBalanceMessage(warningText || t('planner.balanceFallback'))
    } catch (error) {
      setBalanceMessage(error instanceof Error ? error.message : t('planner.balanceFailed'))
    } finally {
      setIsBalancingAssignments(false)
    }
  }

  useEffect(() => {
    if (!user) {
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
    planAssignments,
    plannedCourses,
    plannerRuleGroups,
    plannerStudyProgramCode,
    setAssignment,
    user,
  ])

  if (!isAuthenticated || !user) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
            {t('planner.title')}
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            {t('planner.guestSubtitle')}
          </p>
        </div>
        <PersonalFeatureNotice
          title={t('planner.guestTitle')}
          description={t('planner.guestDescription')}
        />
      </PageShell>
    )
  }

  const openCourse = openCourseId
    ? displayCourseById.get(openCourseId) ?? null
    : null
  const openCourseOptions = openCourse
    ? getPlannerCourseAreaOptions(openCourse, displayStudyProgramCode, displayRuleGroups)
    : []
  const isOpenCoursePlanned = openCourse ? displayPlannedCourseIds.includes(openCourse.id) : false
  const openCourseAssignment = openCourse && isOpenCoursePlanned
    ? getCurrentPlannerAssignment(openCourse, {
        studyProgramCode: displayStudyProgramCode,
        regulationRuleGroups: displayRuleGroups,
        planAssignments: displayPlanAssignments,
      })
    : null
  const openCourseSuggestion = openCourse
    ? getSuggestedPlannerAssignment(openCourse, {
        studyProgramCode: displayStudyProgramCode,
        regulationRuleGroups: displayRuleGroups,
        planAssignments: displayPlanAssignments,
        plannedCourses: displayPlannedCourses,
        completedCourses: displayCompletedCourses,
      })
    : null

  const plannerFavoritesPanel = (
    <PlannerFavoritesPanel
      favoriteCourses={displayFavoriteCourses}
      plannedCourseIds={displayPlannedCourseIds}
      isLoading={isPlannerTourPreview ? false : isLoading}
      error={isPlannerTourPreview ? null : error}
      studyProgramCode={displayStudyProgramCode}
      regulationRuleGroups={displayRuleGroups}
      planAssignments={displayPlanAssignments}
      plannedCourses={displayPlannedCourses}
      completedCourses={displayCompletedCourses}
      maxVisibleCandidates={isPlannerMobileInterestedTour ? 2 : undefined}
      onSetAssignment={setAssignment}
      onAddCourse={handleInterestedCourseAdd}
      onToggleFavorite={toggleFavorite}
    />
  )

  return (
    <PageShell>
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg">
          {t('planner.title')}
        </h1>

        <select
          aria-label="Select semester"
          value={activeSemesterLabel}
          onChange={(event) => setActiveSemesterLabel(event.target.value)}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] font-medium text-fg outline-none transition-colors focus:border-primary"
        >
          {semesterOptions.map((semesterLabel) => (
            <option key={semesterLabel} value={semesterLabel}>
              {formatSemesterLabelShort(semesterLabel)}
            </option>
          ))}
        </select>

        <SaveIndicator isSaving={isSavingSemesterPlan} />

        <span className="flex-1" />

        {isSmallViewport ? (
          <button
            type="button"
            data-tour="planner-add"
            onClick={() => setIsAddDrawerOpen(true)}
            className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {t('planner.addCourses')}
          </button>
        ) : null}

        <button
          type="button"
          data-tour="planner-export"
          onClick={handleExportIcs}
          disabled={displayPlannedCourses.length === 0}
          title={t('planner.exportCalendarTitle')}
          className="rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('planner.exportCalendar')}
        </button>
      </div>

      {!isPlannerTourPreview && plannerError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {plannerError}
        </div>
      ) : null}

      {!isPlannerTourPreview && regulationVersionError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {regulationVersionError}
        </div>
      ) : null}

      {!isPlannerTourPreview && completedCoursesError ? (
        <div className="mb-4 rounded-[10px] border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-primary">
          {completedCoursesError}
        </div>
      ) : null}

      {completionNotice ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg">
          {completionNotice}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4.5">
        <PlannerProgressStrip
          plannedCourses={displayPlannedCourses}
          completedCourses={displayCompletedCourses}
          studyProgramCode={displayStudyProgramCode}
          planAssignments={displayPlanAssignments}
          regulationRuleGroups={displayRuleGroups}
        />

        <div
          className={`grid min-w-0 items-start gap-4.5 ${
            favoritesLayout === 'sidebar'
              ? 'min-[1100px]:grid-cols-[minmax(0,1fr)_19rem] min-[1100px]:items-stretch'
              : ''
          }`}
        >
          <div className="grid min-w-0 gap-4.5">
            {!isPlannerTourPreview && isLoadingSemesterPlan && !savedPlan && plannedCourseIds.length === 0 ? (
              <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
                {t('planner.loadingPlan', { semester: activeSemesterLabel })}
              </div>
            ) : (
              <PlannerGrid
                plannedCourses={displayPlannedCourses}
                hiddenSlotIds={displayHiddenSlotIds}
                isMobilePlanner={isSmallViewport}
                canCompleteSemester={displayPlannedCourses.length > 0}
                activeSemesterLabel={activeSemesterLabel}
                isLoadingSemesterPlan={isLoadingSemesterPlan}
                onDropCourse={handleAddCourse}
                onOpenCourse={(courseId) => setOpenCourseId(courseId)}
                onRequestAdd={() => setIsAddDrawerOpen(true)}
                onOpenCompletionDialog={() => {
                  clearCompletedCoursesError()
                  setCompletionNotice(null)
                  setIsCompletionDialogOpen(true)
                }}
              />
            )}
          </div>

          {!isSmallViewport ? plannerFavoritesPanel : null}
        </div>

        <PlannerFeedback
          plannedCourses={displayPlannedCourses}
          completedCourses={displayCompletedCourses}
          studyProgramCode={displayStudyProgramCode}
          planAssignments={displayPlanAssignments}
          regulationRuleGroups={displayRuleGroups}
          isLoadingRegulationVersion={isPlannerTourPreview ? false : isLoadingRegulationVersion}
          isBalancing={isBalancingAssignments}
          balanceMessage={balanceMessage}
          onSetAssignments={setAssignments}
          onRemoveCourse={handleRemoveCourse}
          onAutoBalance={handleAutoBalanceAssignments}
        />
      </div>

      {isSmallViewport ? (
        <MobilePlannerFavoritesDrawer
          isOpen={isAddDrawerOpen || shouldShowTourAddDrawer}
          onClose={() => setIsAddDrawerOpen(false)}
        >
          {plannerFavoritesPanel}
        </MobilePlannerFavoritesDrawer>
      ) : null}

      {openCourse ? (
        <PlannerCourseDetailModal
          course={openCourse}
          isPlanned={isOpenCoursePlanned}
          areaOptions={openCourseOptions}
          assignedAreaCode={openCourseAssignment}
          suggestedAreaCode={openCourseSuggestion}
          onAdd={(courseId, areaCode) => {
            handleAddCourse(courseId, areaCode)
            setIsAddDrawerOpen(false)
          }}
          onRemove={handleRemoveCourse}
          onSetAssignment={setAssignment}
          onClose={() => setOpenCourseId(null)}
        />
      ) : null}

      {isCompletionDialogOpen ? (
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
    </PageShell>
  )
}
