import { PageShell } from '../../../shared/components/PageShell'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useAuth } from '../../auth'
import type { MasterCat } from '../../courses'
import { useTranslation } from '../../i18n'
import { getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'
import { useProgressSnapshot } from '../hooks/useProgressSnapshot'
import { MASTER_CATEGORY_META } from '../masterCategoryMeta'
import type { CategoryProgress as CategoryProgressItem, ProgressSnapshot, ThesisProgress } from '../types'
import { CategoryProgress } from './CategoryProgress'
import { IntermediateExamNotice } from './IntermediateExamNotice'
import { RegulationProgress } from './RegulationProgress'
import { SpecializationCircle } from './SpecializationCircle'

const CORE_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO']
const ELECTIVE_CATEGORIES: MasterCat[] = ['BASIS']
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
  const { t } = useTranslation()
  const { progressSnapshot, isLoadingProgress, progressError } = useProgressSnapshot()

  if (isLoadingProgress || !progressSnapshot) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
            {t('progress.title')}
          </h1>
          <p className="text-[13.5px] text-fg-muted">{t('progress.loadingSubtitle')}</p>
        </div>
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {progressError ? `${t('progress.failed')} ${progressError}` : t('progress.loading')}
        </div>
      </PageShell>
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
      label: t('progress.totalEcts'),
      value: String(progressSnapshot.summary.totalEcts),
      sub: `/ ${progressSnapshot.summary.requiredEcts} ECTS`,
    },
    {
      label: t('progress.progress'),
      value: `${progressSnapshot.summary.progressPercentage} %`,
      sub: t('progress.ofDegree'),
    },
    {
      label: t('progress.averageGrade'),
      value:
        progressSnapshot.summary.averageGrade !== null
          ? progressSnapshot.summary.averageGrade.toFixed(2)
          : '–',
    },
  ]

  return (
    <PageShell>
      <div className="mb-6" data-tour="overview-page">
        <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
          {t('progress.title')}
        </h1>
        <p className="text-[13.5px] text-fg-muted">{subtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded-[10px] border border-border bg-surface px-4 py-4 sm:gap-6 sm:px-6 sm:py-4.5">
        {stats.map((stat, i) => (
          <div key={stat.label} className={`min-w-0 overflow-hidden ${i > 0 ? 'border-l border-border-light pl-3 sm:pl-6' : ''}`}>
            <StatItem {...stat} />
          </div>
        ))}
      </div>

      {progressSnapshot.intermediateExam !== null &&
        !progressSnapshot.intermediateExam.isFulfilled && (
          <div className="mt-4.5">
            <IntermediateExamNotice status={progressSnapshot.intermediateExam} />
          </div>
        )}

      <div className="mt-4.5 grid grid-cols-1 gap-4.5 lg:grid-cols-2">
        {progressSnapshot.regulationProgress.length > 0 ? (
          <RegulationProgress areas={progressSnapshot.regulationProgress} />
        ) : (
          <CategoryProgress core={core} electives={electives} thesis={thesis} />
        )}
        <SpecializationCircle categories={progressSnapshot.visualizationCategories} />
      </div>
    </PageShell>
  )
}

export function Dashboard() {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()

  if (!isAuthenticated) {
    return (
      <PageShell>
        <div className="mb-6">
          <h1 className="mb-0.75 text-[22px] font-semibold tracking-[-0.01em] text-fg">
            {t('progress.title')}
          </h1>
          <p className="text-[13.5px] text-fg-muted">{t('progress.guestSubtitle')}</p>
        </div>
        <PersonalFeatureNotice
          title={t('progress.guestTitle')}
          description={t('progress.guestDescription')}
        />
      </PageShell>
    )
  }

  return <AuthenticatedDashboard />
}
