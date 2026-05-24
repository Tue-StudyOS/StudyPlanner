import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useAuth } from '../../auth'
import type { MasterCat } from '../../courses'
import { MASTER_CATEGORY_META } from '../masterCategoryMeta'
import type { CategoryProgress as CategoryProgressItem, ProgressSnapshot, ThesisProgress } from '../types'
import { useProgressSnapshot } from '../hooks/useProgressSnapshot'
import { CategoryProgress } from './CategoryProgress'
import { CompletedCourses } from './CompletedCourses'
import { SpecializationCircle } from './SpecializationCircle'
import { getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'

const CORE_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO']
const ELECTIVE_CATEGORIES: MasterCat[] = ['FOKUS', 'BASIS']
const REQUIRED_ECTS_PER_CATEGORY = 18
const REQUIRED_ECTS_THESIS = 30

function toCategoryProgress(snapshot: ProgressSnapshot): {
  core: CategoryProgressItem[]
  electives: CategoryProgressItem[]
  thesis: ThesisProgress
} {
  const earnedByCategory = new Map<MasterCat, number>()
  snapshot.masterCategoryProgress.forEach((entry) => {
    earnedByCategory.set(entry.cat, entry.earnedEcts)
  })

  const buildProgress = (category: MasterCat): CategoryProgressItem => ({
    cat: category,
    label: MASTER_CATEGORY_META[category].fullLabel,
    earnedEcts: earnedByCategory.get(category) ?? 0,
    requiredEcts: REQUIRED_ECTS_PER_CATEGORY,
  })

  return {
    core: CORE_CATEGORIES.map(buildProgress),
    electives: ELECTIVE_CATEGORIES.map(buildProgress),
    thesis: {
      label: 'Master Thesis',
      earnedEcts: 0,
      requiredEcts: REQUIRED_ECTS_THESIS,
    },
  }
}

function AuthenticatedDashboard() {
  const { user } = useAuth()
  const { progressSnapshot, isLoadingProgress, progressError } = useProgressSnapshot()

  if (isLoadingProgress || !progressSnapshot) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
            Study Overview
          </h1>
          <p className="text-[13.5px] text-fg-muted">Loading your persisted study progress...</p>
        </div>
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {progressError ? `Failed to load progress data. ${progressError}` : 'Loading progress data...'}
        </div>
      </div>
    )
  }

  const { core, electives, thesis } = toCategoryProgress(progressSnapshot)
  const subtitle = [
    getCurrentSemesterLabel(),
    user?.profile.studyProgramName ?? progressSnapshot.profileName,
  ]
    .filter((part) => Boolean(part && part.trim().length > 0))
    .join(' · ')

  const stats = [
    {
      label: 'Total ECTS',
      value: String(progressSnapshot.summary.totalEcts),
      sub: `/ ${progressSnapshot.summary.requiredEcts} ECTS`,
    },
    {
      label: 'Progress',
      value: `${progressSnapshot.summary.progressPercentage} %`,
      sub: 'of degree',
    },
    {
      label: 'Average grade',
      value:
        progressSnapshot.summary.averageGrade !== null
          ? progressSnapshot.summary.averageGrade.toFixed(2)
          : '–',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Study Overview
        </h1>
        <p className="text-[13.5px] text-fg-muted">{subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-6 rounded-[10px] border border-border bg-surface px-6 py-4.5">
        {stats.map((stat, i) => (
          <div key={stat.label} className={i > 0 ? 'border-l border-border-light pl-6' : ''}>
            <StatItem {...stat} />
          </div>
        ))}
      </div>

      <div className="mt-4.5 grid grid-cols-2 gap-4.5">
        <CategoryProgress core={core} electives={electives} thesis={thesis} />
        <SpecializationCircle
          categories={progressSnapshot.visualizationCategories}
          profileName={progressSnapshot.profileName}
        />
      </div>

      {progressSnapshot.unmappedCompletedCourses.length > 0 ? (
        <div className="mt-4.5 rounded-[10px] border border-border bg-surface px-6 py-4 text-[13px] text-fg-muted">
          {progressSnapshot.unmappedCompletedCourses.length} completed course(s) are not mapped to a
          specialization category yet.
        </div>
      ) : null}

      <div className="mt-4.5">
        <CompletedCourses />
      </div>
    </div>
  )
}

export function Dashboard() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <div className="p-8">
        <div className="mb-6">
          <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
            Study Overview
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            Your personal progress becomes available after you sign in.
          </p>
        </div>
        <PersonalFeatureNotice
          title="Progress is personal"
          description="The dashboard, category progress, and completed-course history belong to your account. Sign in to save and view your own study progress while the public catalog stays available without login."
        />
      </div>
    )
  }

  return <AuthenticatedDashboard />
}
