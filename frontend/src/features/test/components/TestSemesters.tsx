import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import { fetchSemesterPlans } from '../../planner/api'
import type { SemesterPlanSummary } from '../../planner/types'
import { formatSemesterLabelShort, getCurrentSemesterLabel } from '../../planner/utils/semesterLabels'
import { TEST_ROUTES, testSemesterPath } from '../../routes'
import { RequireTestAuth } from './RequireTestAuth'
import { RevealItem } from './RevealItem'
import {
  buildSemesterBlocks,
  canAddEmptySemester,
  nextEmptySemesterLabel,
} from '../utils/semesterBlocks'

const BLOCK_CARD_CLASS =
  'flex h-full min-h-[5.5rem] w-full min-w-0 flex-col justify-between gap-2 rounded-[12px] border border-border bg-surface p-4 transition-all duration-150 hover:border-primary hover:shadow-md'

function SemestersInner() {
  const { token, user } = useAuth()
  const { t } = useTranslation()
  const [savedPlans, setSavedPlans] = useState<SemesterPlanSummary[]>([])
  const [extraEmptyLabel, setExtraEmptyLabel] = useState<string | null>(null)
  const startLabel = user?.profile.currentSemesterLabel ?? null

  useEffect(() => {
    if (!token) return
    let active = true
    fetchSemesterPlans(token)
      .then((plans) => { if (active) setSavedPlans(plans) })
      .catch(() => { /* index stays empty; the page still works */ })
    return () => { active = false }
  }, [token])

  const blocks = useMemo(
    () => buildSemesterBlocks(savedPlans, startLabel, extraEmptyLabel),
    [savedPlans, startLabel, extraEmptyLabel],
  )
  const addDisabled = !canAddEmptySemester(blocks)

  function handleAdd(): void {
    const fallbackLabel = startLabel ?? getCurrentSemesterLabel()
    setExtraEmptyLabel(nextEmptySemesterLabel(blocks, fallbackLabel))
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold text-fg">{t('test.semesters.title')}</h1>
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
            <RevealItem key={block.label} index={index}>
              <Link to={testSemesterPath(block.label)} className={BLOCK_CARD_CLASS}>
                <span className="text-[15px] font-semibold text-fg">{formatSemesterLabelShort(block.label)}</span>
                <span className="text-[12px] text-fg-muted">
                  {block.isEmpty
                    ? t('test.semesters.emptyBlock')
                    : t('test.semesters.courseCount', { count: block.courseCount })}
                </span>
              </Link>
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
