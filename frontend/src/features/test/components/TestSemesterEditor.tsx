import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { useCatalogCourses, ALL_CATALOG_PERIODS } from '../../courses'
import type { Course } from '../../courses'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { fetchSemesterPlan } from '../../planner/api'
import type { SemesterPlan } from '../../planner/types'
import { SemesterCompletionDialog } from '../../planner/components/SemesterCompletionDialog'
import { fetchCompletedCourses, saveCompletedCourses } from '../../transcript/api'
import { fetchAnrechnungOptimization, type AnrechnungOptimization } from '../api'
import { RequireTestAuth } from './RequireTestAuth'

function EditorInner() {
  const { label = '' } = useParams<{ label: string }>()
  const { token, user } = useAuth()
  const { t } = useTranslation()

  // Anrechnung optimizer state
  const [optimization, setOptimization] = useState<AnrechnungOptimization | null>(null)
  const [isLoadingOptimizer, setIsLoadingOptimizer] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [optimizerError, setOptimizerError] = useState<string | null>(null)

  // Semester completion state
  const [semesterPlan, setSemesterPlan] = useState<SemesterPlan | null>(null)
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false)
  const [completionNotice, setCompletionNotice] = useState<string | null>(null)

  const { courses: allCatalogCourses } = useCatalogCourses('', 1000, ALL_CATALOG_PERIODS)
  const { regulationVersion } = useRegulationVersion(user?.profile.regulationVersionCode)
  const plannerRuleGroups = useMemo(() => regulationVersion?.ruleGroups ?? [], [regulationVersion])
  const studyProgramCode = user?.profile.studyProgramCode ?? null

  const courseById = useMemo(
    () => new Map(allCatalogCourses.map((c) => [c.id, c])),
    [allCatalogCourses],
  )
  const plannedCourses = useMemo<Course[]>(
    () => (semesterPlan?.courseIds ?? []).flatMap((id) => {
      const course = courseById.get(id)
      return course ? [course] : []
    }),
    [semesterPlan, courseById],
  )

  useEffect(() => {
    if (!token) return
    let active = true
    fetchAnrechnungOptimization(token)
      .then((result) => { if (active) setOptimization(result) })
      .catch(() => { if (active) setOptimizerError(t('test.editor.error')) })
      .finally(() => { if (active) setIsLoadingOptimizer(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    if (!token || !label) return
    let active = true
    fetchSemesterPlan(token, label)
      .then((plan) => { if (active) setSemesterPlan(plan) })
      .catch(() => {})
    return () => { active = false }
  }, [token, label])

  async function handleApply(): Promise<void> {
    if (!token || !optimization) return
    setIsApplying(true)
    setOptimizerError(null)
    try {
      const changeByCourseId = new Map(
        optimization.changes.map((change) => [change.completedCourseId, change.toAreaCode]),
      )
      const completedCourses = await fetchCompletedCourses(token)
      const nextCompletedCourses = completedCourses.map((course) =>
        changeByCourseId.has(course.id)
          ? { ...course, studyAreaCode: changeByCourseId.get(course.id) ?? course.studyAreaCode }
          : course,
      )
      await saveCompletedCourses(token, nextCompletedCourses)
      setApplied(true)
      const refreshed = await fetchAnrechnungOptimization(token)
      setOptimization(refreshed)
    } catch {
      setOptimizerError(t('test.editor.error'))
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* Section 1: Semester completion */}
      <section className="mb-8">
        <h2 className="text-[16px] font-semibold text-fg">{t('test.editor.completeTitle')}</h2>
        <p className="mt-1 text-[13px] text-fg-muted">{t('test.editor.completeIntro')}</p>

        {completionNotice ? (
          <p className="mt-3 text-[13px] font-medium text-fg">{completionNotice}</p>
        ) : (
          <button
            type="button"
            onClick={() => setCompletionDialogOpen(true)}
            disabled={plannedCourses.length === 0}
            className="mt-3 rounded-md border border-border px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('test.editor.completeButton', { count: plannedCourses.length })}
          </button>
        )}
      </section>

      <hr className="border-border" />

      {/* Section 2: Anrechnung optimizer */}
      <section className="mt-8">
        <h2 className="text-[16px] font-semibold text-fg">{t('test.editor.title')}</h2>
        <p className="mt-1 text-[13px] text-fg-muted">{t('test.editor.intro')}</p>

        <div className="mt-5">
          {isLoadingOptimizer ? (
            <p className="text-[13px] text-fg-muted">{t('test.editor.checking')}</p>
          ) : optimizerError ? (
            <p className="text-[13px] text-danger">{optimizerError}</p>
          ) : optimization && optimization.hasImprovement ? (
            <div className="rounded-[12px] border border-primary/30 bg-primary/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-fg">{t('test.editor.available')}</div>
                  <div className="text-[12.5px] text-primary">
                    {t('test.editor.gain', {
                      ects: optimization.gainedEcts,
                      areas: optimization.gainedAreas,
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleApply()}
                  disabled={isApplying}
                  className="rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isApplying ? t('test.editor.applying') : t('test.editor.apply')}
                </button>
              </div>

              <ul className="mt-3 grid gap-1.5">
                {optimization.changes.map((change) => (
                  <li key={change.completedCourseId} className="min-w-0 break-words text-[12.5px] text-fg">
                    <span className="font-medium">{change.title}</span>
                    <span className="text-fg-muted">
                      {' — '}
                      {change.fromAreaName ?? change.fromAreaCode ?? '—'} → {change.toAreaName ?? change.toAreaCode}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[13px] text-fg-muted">
              {applied ? t('test.editor.applied') : t('test.editor.optimal')}
            </p>
          )}
        </div>
      </section>

      {completionDialogOpen && semesterPlan ? (
        <SemesterCompletionDialog
          semesterLabel={label}
          plannedCourses={plannedCourses}
          planAssignments={semesterPlan.courseAssignments}
          studyProgramCode={studyProgramCode}
          regulationRuleGroups={plannerRuleGroups}
          onClose={() => setCompletionDialogOpen(false)}
          onSuccess={(message) => {
            setCompletionNotice(message)
            setCompletionDialogOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}

export function TestSemesterEditor() {
  return (
    <RequireTestAuth>
      <EditorInner />
    </RequireTestAuth>
  )
}
