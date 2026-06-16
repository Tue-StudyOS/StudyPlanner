import { useMemo } from 'react'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { formatRegulationAreaShortLabel } from '../../../shared/utils/regulation'
import { buildPlannerProgressAreas, roundEcts } from '../utils/plannerProgress'
import { getBalancedColumnCount } from '../utils/progressStripLayout'

// Static class lookups so the dynamic column count maps to classes Tailwind can
// see at build time (template-literal column counts would get purged). Mobile
// stays at most 2 columns and tablets at most 3 for width; only lg goes wider.
const BASE_GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2' }
const SM_GRID_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
}
const LG_GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

// Each area bar is tinted in its study-area tag color; areas without a mapped
// category fall back to a neutral fill.
const CAT_BAR_CLASS: Record<MasterCat, { credited: string; planned: string }> = {
  TECH: { credited: 'bg-cat-tech', planned: 'bg-cat-tech/40' },
  THEO: { credited: 'bg-cat-theo', planned: 'bg-cat-theo/40' },
  PRAK: { credited: 'bg-cat-prak', planned: 'bg-cat-prak/40' },
  INFO: { credited: 'bg-cat-info', planned: 'bg-cat-info/40' },
  BASIS: { credited: 'bg-cat-basis', planned: 'bg-cat-basis/40' },
}
const DEFAULT_BAR_CLASS = { credited: 'bg-fg-muted', planned: 'bg-fg-muted/40' }

interface PlannerProgressStripProps {
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
}

/**
 * One slim progress bar per study area of the active regulation, each tinted in
 * its tag color and showing the live delta this semester plan adds. Every area
 * is listed (including Überfachliche Kompetenzen), so the planner mirrors the
 * full degree structure at a glance.
 */
export function PlannerProgressStrip({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
}: PlannerProgressStripProps) {
  const areas = useMemo(
    () =>
      buildPlannerProgressAreas({
        plannedCourses,
        completedCourses,
        studyProgramCode,
        planAssignments,
        regulationRuleGroups,
      }).areas,
    [completedCourses, planAssignments, plannedCourses, regulationRuleGroups, studyProgramCode],
  )

  if (areas.length === 0) {
    return null
  }

  const columns = getBalancedColumnCount(areas.length)
  const gridColsClass = [
    BASE_GRID_COLS[Math.min(columns, 2)],
    SM_GRID_COLS[Math.min(columns, 3)],
    LG_GRID_COLS[columns],
  ].join(' ')

  return (
    <div
      data-tour="planner-progress"
      className={`grid ${gridColsClass} gap-x-4 gap-y-2 rounded-[10px] border border-border bg-surface px-3.5 py-2.5`}
    >
      {areas.map((area) => {
        const targetEcts = area.capacityEcts ?? area.requiredEcts
        const hasTarget = targetEcts !== null && targetEcts > 0
        const credited = roundEcts(area.creditedEcts)
        const afterPlanning = roundEcts(area.creditedEcts + area.plannedEcts)
        const creditedWidth = hasTarget ? Math.min((area.creditedEcts / targetEcts) * 100, 100) : 0
        const plannedWidth = hasTarget
          ? Math.min((area.plannedEcts / targetEcts) * 100, Math.max(0, 100 - creditedWidth))
          : 0
        const barClass = (area.masterCat ? CAT_BAR_CLASS[area.masterCat] : undefined) ?? DEFAULT_BAR_CLASS

        return (
          <div key={area.code} className="min-w-0" title={area.name}>
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="truncate font-semibold uppercase tracking-[0.06em] text-fg-mid">
                {formatRegulationAreaShortLabel(area.code)}
              </span>
              <span className="shrink-0 tabular-nums text-fg-muted">
                {area.plannedEcts > 0 ? (
                  <>
                    {credited}
                    <span aria-hidden="true" className="px-0.5">→</span>
                    <span className="font-semibold text-fg">{afterPlanning}</span>
                  </>
                ) : (
                  credited
                )}
                {hasTarget ? `/${roundEcts(targetEcts)}` : ''}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border-light">
              <div className="flex h-full">
                <div className={barClass.credited} style={{ width: `${creditedWidth}%` }} />
                <div className={barClass.planned} style={{ width: `${plannedWidth}%` }} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
