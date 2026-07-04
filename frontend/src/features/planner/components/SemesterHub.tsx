import { PageShell } from '../../../shared/components/PageShell'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { semesterPath } from '../../routes'
import { useSemesterPlanner } from '../hooks/useSemesterPlanner'
import { SemesterCard } from './SemesterCard'

export function SemesterHub() {
  const { isAuthenticated, user } = useAuth()
  const { t } = useTranslation()
  const { progressSnapshot } = useProgressSnapshot()
  const { semesterOptions } = useSemesterPlanner()

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
    <PageShell>
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-fg">{t('planner.title')}</h1>
        <p className="mt-1 max-w-[40rem] text-[13px] text-fg-muted">
          Pick a semester to open its weekly plan and area outlook.
        </p>
      </div>

      {progressSnapshot ? (
        <div className="mb-5 grid grid-cols-3 gap-3 rounded-[10px] border border-border bg-surface px-4 py-4 sm:gap-6 sm:px-6 sm:py-4.5">
          <div className="min-w-0 overflow-hidden">
            <StatItem
              label={t('progress.totalEcts')}
              value={String(progressSnapshot.summary.totalEcts)}
              sub={`/ ${progressSnapshot.summary.requiredEcts} ECTS`}
            />
          </div>
          <div className="min-w-0 overflow-hidden border-l border-border-light pl-3 sm:pl-6">
            <StatItem
              label={t('progress.progress')}
              value={`${progressSnapshot.summary.progressPercentage} %`}
              sub={t('progress.ofDegree')}
            />
          </div>
          <div className="min-w-0 overflow-hidden border-l border-border-light pl-3 sm:pl-6">
            <StatItem
              label={t('progress.averageGrade')}
              value={
                progressSnapshot.summary.averageGrade !== null
                  ? progressSnapshot.summary.averageGrade.toFixed(2)
                  : '–'
              }
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0">
        <div className="mb-3 text-[13px] font-semibold text-fg">{t('planner.semestersTitle')}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {semesterOptions.map((semesterLabel) => (
            <SemesterCard
              key={semesterLabel}
              semesterLabel={semesterLabel}
              to={semesterPath(semesterLabel)}
            />
          ))}
        </div>
      </div>
    </PageShell>
  )
}
