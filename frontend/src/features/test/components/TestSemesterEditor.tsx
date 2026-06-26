import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { SemesterPlanner } from '../../planner/components/SemesterPlanner'
import { fetchCompletedCourses, saveCompletedCourses } from '../../transcript/api'
import { fetchAnrechnungOptimization, type AnrechnungOptimization } from '../api'
import { RequireTestAuth } from './RequireTestAuth'

function AnrechnungOptimizerPanel() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [optimization, setOptimization] = useState<AnrechnungOptimization | null>(null)
  const [isLoadingOptimizer, setIsLoadingOptimizer] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [optimizerError, setOptimizerError] = useState<string | null>(null)

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
    <div className="mx-auto w-full max-w-6xl px-4 pb-10">
      <section className="rounded-[18px] border border-border bg-surface p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-fg">{t('test.editor.title')}</h2>
            <p className="mt-1 max-w-2xl break-words text-[13px] leading-5 text-fg-muted">{t('test.editor.intro')}</p>
          </div>
        </div>

        <div className="mt-5">
          {isLoadingOptimizer ? (
            <p className="text-[13px] text-fg-muted">{t('test.editor.checking')}</p>
          ) : optimizerError ? (
            <p className="text-[13px] text-danger">{optimizerError}</p>
          ) : optimization && optimization.hasImprovement ? (
            <div className="rounded-[14px] border border-primary/30 bg-primary/5 p-4">
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
    </div>
  )
}

function EditorInner() {
  const { label = '' } = useParams<{ label: string }>()

  return (
    <>
      <SemesterPlanner initialSemesterLabel={label} renderMode="badge" />
      <AnrechnungOptimizerPanel />
    </>
  )
}

export function TestSemesterEditor() {
  return (
    <RequireTestAuth>
      <EditorInner />
    </RequireTestAuth>
  )
}
