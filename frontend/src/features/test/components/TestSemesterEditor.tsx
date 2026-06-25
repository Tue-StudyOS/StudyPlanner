import { useEffect, useState } from 'react'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { fetchCompletedCourses, saveCompletedCourses } from '../../transcript/api'
import { fetchAnrechnungOptimization, type AnrechnungOptimization } from '../api'
import { RequireTestAuth } from './RequireTestAuth'

function EditorInner() {
  const { token } = useAuth()
  const { t } = useTranslation()
  const [optimization, setOptimization] = useState<AnrechnungOptimization | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isApplying, setIsApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let active = true
    fetchAnrechnungOptimization(token)
      .then((result) => { if (active) setOptimization(result) })
      .catch(() => { if (active) setError(t('test.editor.error')) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function handleApply(): Promise<void> {
    if (!token || !optimization) return
    setIsApplying(true)
    setError(null)
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
      setError(t('test.editor.error'))
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-[20px] font-semibold text-fg">{t('test.editor.title')}</h1>
      <p className="mt-1 text-[13px] text-fg-muted">{t('test.editor.intro')}</p>

      <div className="mt-5">
        {isLoading ? (
          <p className="text-[13px] text-fg-muted">{t('test.editor.checking')}</p>
        ) : error ? (
          <p className="text-[13px] text-danger">{error}</p>
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
