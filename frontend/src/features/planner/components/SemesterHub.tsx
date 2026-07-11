import { useEffect, useMemo, useState } from 'react'
import { PageShell } from '../../../shared/components/PageShell'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { useOnboarding } from '../../onboarding'
import { isSemesterHubTourStep, TOUR_SEMESTER_HUB_STATS } from '../../onboarding/utils/tourPreviewData.ts'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { semesterPath } from '../../routes'
import { useTranscript } from '../../transcript'
import { ALL_CATALOG_PERIODS, useCatalogCourses } from '../../courses'
import { fetchSemesterPlan } from '../api'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import { buildSemesterCardStats, type SemesterCardPlanDetails } from '../utils/semesterCardStats.ts'
import { findOldestSemesterLabel } from '../utils/semesterHubVisibility.ts'
import { SemesterCard } from './SemesterCard'

export function SemesterHub() {
  const { isAuthenticated, csrfToken, user } = useAuth()
  const { t } = useTranslation()
  const { isOpen: isOnboardingOpen, activeStepId } = useOnboarding()
  const isSemesterHubTour = isOnboardingOpen && isSemesterHubTourStep(activeStepId)
  const { progressSnapshot } = useProgressSnapshot()
  const {
    activeSemesterLabel,
    semesterOptions,
    savedPlans,
    plannedCourseIds,
    planAssignments,
    savedPlan,
  } = useSemesterPlanner()
  const { completedCourses } = useTranscript()
  const { courses: catalogCourses } = useCatalogCourses('', 1000, ALL_CATALOG_PERIODS)
  const isMobileSemesterList = useMediaQuery('(max-width: 960px)')
  const displayedSemesterOptions = isMobileSemesterList
    ? [...semesterOptions].reverse()
    : semesterOptions
  const oldestSemesterLabel = findOldestSemesterLabel(semesterOptions)
  const savedPlanLabels = useMemo(() => {
    const labels = new Set<string>()
    for (const plan of savedPlans) {
      const normalizedLabel = plan.semesterLabel.trim()
      if (normalizedLabel) {
        labels.add(normalizedLabel)
      }
    }
    return [...labels].sort((left, right) => left.localeCompare(right, 'de'))
  }, [savedPlans])
  const [savedPlanDetailsBySemester, setSavedPlanDetailsBySemester] = useState<Record<string, SemesterCardPlanDetails>>({})

  useEffect(() => {
    let isActive = true

    async function loadSavedPlanDetails(): Promise<void> {
      if (!csrfToken || savedPlanLabels.length === 0) {
        setSavedPlanDetailsBySemester({})
        return
      }

      const entries = await Promise.all(
        savedPlanLabels.map(async (semesterLabel) => {
          try {
            return [semesterLabel, await fetchSemesterPlan(semesterLabel)] as const
          } catch {
            return [semesterLabel, null] as const
          }
        }),
      )
      if (!isActive) {
        return
      }

      const nextDetailsBySemester: Record<string, SemesterCardPlanDetails> = {}
      for (const [semesterLabel, plan] of entries) {
        if (plan) {
          nextDetailsBySemester[semesterLabel] = {
            courseIds: plan.courseIds,
            courseAssignments: plan.courseAssignments,
          }
        }
      }
      setSavedPlanDetailsBySemester(nextDetailsBySemester)
    }

    void loadSavedPlanDetails()

    return () => {
      isActive = false
    }
  }, [savedPlanLabels, csrfToken])

  const planDetailsBySemester = useMemo(() => {
    const nextDetailsBySemester = { ...savedPlanDetailsBySemester }
    if (savedPlan || plannedCourseIds.length > 0 || Object.keys(planAssignments).length > 0) {
      nextDetailsBySemester[activeSemesterLabel] = {
        courseIds: plannedCourseIds,
        courseAssignments: planAssignments,
      }
    }
    return nextDetailsBySemester
  }, [activeSemesterLabel, planAssignments, plannedCourseIds, savedPlan, savedPlanDetailsBySemester])

  const displayStats = isSemesterHubTour
    ? TOUR_SEMESTER_HUB_STATS
    : progressSnapshot
      ? {
          totalEcts: progressSnapshot.summary.totalEcts,
          requiredEcts: progressSnapshot.summary.requiredEcts,
          progressPercentage: progressSnapshot.summary.progressPercentage,
          averageGrade: progressSnapshot.summary.averageGrade,
        }
      : null

  if (!isAuthenticated || !user) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
            {t('planner.title')}
          </h1>
          <p className="text-[13.5px] text-fg-muted">{t('planner.guestSubtitle')}</p>
        </div>
        <PersonalFeatureNotice
          title={t('planner.guestTitle')}
          description={t('planner.guestDescription')}
        />
      </PageShell>
    )
  }

  return (
    <PageShell className="pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg">{t('planner.title')}</h1>
        <p className="mt-1 max-w-[40rem] text-[13px] text-fg-muted">
          Pick a semester to open its weekly plan and area outlook.
        </p>
      </div>

      {displayStats ? (
        <div
          data-tour="semester-hub-stats"
          className="mb-5 grid grid-cols-3 gap-3 rounded-[10px] border border-border bg-surface px-4 py-4 sm:gap-6 sm:px-6 sm:py-4.5"
        >
          <div className="min-w-0 overflow-hidden">
            <StatItem
              label={t('progress.totalEcts')}
              value={String(displayStats.totalEcts)}
              sub={`/ ${displayStats.requiredEcts} ECTS`}
            />
          </div>
          <div className="min-w-0 overflow-hidden border-l border-border-light pl-3 sm:pl-6">
            <StatItem
              label={t('progress.progress')}
              value={`${displayStats.progressPercentage} %`}
              sub={t('progress.ofDegree')}
            />
          </div>
          <div className="min-w-0 overflow-hidden border-l border-border-light pl-3 sm:pl-6">
            <StatItem
              label={t('progress.averageGrade')}
              value={
                displayStats.averageGrade !== null
                  ? displayStats.averageGrade.toFixed(2)
                  : '–'
              }
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0" data-tour="semester-hub-cards">
        <div className="mb-3 text-[13px] font-semibold text-fg">{t('planner.semestersTitle')}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSemesterOptions.map((semesterLabel) => (
            <SemesterCard
              key={semesterLabel}
              semesterLabel={semesterLabel}
              to={semesterPath(semesterLabel)}
              tourAnchorId={semesterLabel === oldestSemesterLabel ? 'semester-hub-card' : undefined}
              stats={buildSemesterCardStats(
                semesterLabel,
                savedPlans,
                completedCourses,
                catalogCourses,
                {},
                planDetailsBySemester,
              )}
            />
          ))}
        </div>
      </div>
    </PageShell>
  )
}
