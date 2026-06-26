import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { fetchSemesterPlans } from '../../planner/api'
import type { SemesterPlanSummary } from '../../planner/types'
import { formatSemesterLabelShort, getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'
import { fetchCompletedCourses } from '../../transcript/api'
import type { CompletedCourse } from '../../courses'
import { TEST_ROUTES, testSemesterPath } from '../../routes'
import { RequireTestAuth } from './RequireTestAuth'
import { RevealItem } from './RevealItem'
import {
  buildSemesterBlocks,
  canAddEmptySemester,
  nextEmptySemesterLabel,
  type SemesterBlock,
} from '../utils/semesterBlocks'

function BlockCard({ block }: { block: SemesterBlock }) {
  const { t } = useTranslation()
  const detailText = block.isHistorical
    ? `${t('test.semesters.historical')} · ${t('test.semesters.courseCount', { count: block.courseCount })}`
    : block.isEmpty
      ? t('test.semesters.emptyBlock')
      : t('test.semesters.courseCount', { count: block.courseCount })

  return (
    <Link
      to={testSemesterPath(block.label)}
      className={`group relative isolate flex h-full min-h-[7.25rem] w-full min-w-0 flex-col justify-between overflow-hidden rounded-[18px] border p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 ${
        block.isHistorical
          ? 'border-dashed border-primary/30 bg-primary/5'
          : block.isEmpty
            ? 'border-dashed border-border bg-surface/70'
            : 'border-border bg-surface hover:border-primary/40'
      }`}
    >
      <span className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-primary/10 transition-transform duration-200 group-hover:scale-110" />
      <span className="relative z-10 min-w-0">
        <span className="block text-[17px] font-semibold tracking-[-0.01em] text-fg">
          {formatSemesterLabelShort(block.label)}
        </span>
        <span className="mt-1 block break-words text-[12.5px] leading-5 text-fg-muted">
          {detailText}
        </span>
      </span>
      <span className="relative z-10 mt-4 flex items-center justify-between gap-3">
        <span className="h-px min-w-0 flex-1 bg-border" />
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 text-primary">
          →
        </span>
      </span>
    </Link>
  )
}

function SemestersInner() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const [savedPlans, setSavedPlans] = useState<SemesterPlanSummary[]>([])
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([])
  const [extraEmptyLabel, setExtraEmptyLabel] = useState<string | null>(null)
  const startLabel = user?.profile.currentSemesterLabel ?? null

  useEffect(() => {
    if (!token) return
    let active = true
    fetchSemesterPlans(token)
      .then((plans) => { if (active) setSavedPlans(plans) })
      .catch(() => {})
    fetchCompletedCourses(token)
      .then((courses) => { if (active) setCompletedCourses(courses) })
      .catch(() => {})
    return () => { active = false }
  }, [token])

  const historicalSemesters = useMemo(() => {
    const countBySemester = new Map<string, number>()
    for (const course of completedCourses) {
      const semesterLabel = course.semester?.trim()
      if (!semesterLabel) {
        continue
      }
      countBySemester.set(semesterLabel, (countBySemester.get(semesterLabel) ?? 0) + 1)
    }
    return [...countBySemester.entries()].map(([semesterLabel, courseCount]) => ({ semesterLabel, courseCount }))
  }, [completedCourses])

  const blocks = useMemo(
    () => buildSemesterBlocks(savedPlans, startLabel, extraEmptyLabel, historicalSemesters),
    [savedPlans, startLabel, extraEmptyLabel, historicalSemesters],
  )
  const addDisabled = !canAddEmptySemester(blocks)

  function handleAdd(): void {
    const fallbackLabel = startLabel ?? getCurrentSemesterLabel()
    setExtraEmptyLabel(nextEmptySemesterLabel(blocks, fallbackLabel))
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-fg">{t('test.semesters.title')}</h1>
          <p className="mt-1 text-[13px] text-fg-muted">{t('test.semesters.desc')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={TEST_ROUTES.catalog}
            className="rounded-md border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-fg-mid transition-colors hover:bg-surface-hover"
          >
            {t('nav.catalog')}
          </Link>
          <button
            type="button"
            onClick={handleAdd}
            disabled={addDisabled}
            className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + {t('test.semesters.addBlock')}
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <p className="text-[13px] text-fg-muted">{t('test.semesters.empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {blocks.map((block, index) => (
            <RevealItem key={block.label} index={Math.min(index, 5)}>
              <BlockCard block={block} />
            </RevealItem>
          ))}
        </div>
      )}
    </div>
  )
}

export function TestSemesters() {
  return (
    <RequireTestAuth>
      <SemestersInner />
    </RequireTestAuth>
  )
}
