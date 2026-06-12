import { useMemo } from 'react'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { formatRegulationAreaShortLabel } from '../../../shared/utils/regulation'
import { buildPlannerProgressAreas, roundEcts } from '../utils/plannerProgress'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}

interface PlannerProgressStripProps {
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
}

/**
 * One slim line of degree progress with the live delta this semester plan
 * adds — visible while planning without opening the full outlook below.
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
      }).areas.filter((area) => {
        const targetEcts = area.capacityEcts ?? area.requiredEcts
        if (targetEcts === null || targetEcts <= 0) {
          return area.plannedEcts > 0
        }
        return area.creditedEcts < targetEcts || area.plannedEcts > 0
      }),
    [completedCourses, planAssignments, plannedCourses, regulationRuleGroups, studyProgramCode],
  )

  if (areas.length === 0) {
    return null
  }

  // Overall degree progress across all areas with a target, including the
  // delta this plan adds.
  const totals = areas.reduce(
    (sums, area) => {
      const targetEcts = area.capacityEcts ?? area.requiredEcts
      if (targetEcts === null || targetEcts <= 0) {
        return sums
      }
      return {
        target: sums.target + targetEcts,
        credited: sums.credited + Math.min(area.creditedEcts, targetEcts),
        planned: sums.planned + Math.min(area.plannedEcts, Math.max(0, targetEcts - area.creditedEcts)),
      }
    },
    { target: 0, credited: 0, planned: 0 },
  )
  const creditedWidth = totals.target > 0 ? (totals.credited / totals.target) * 100 : 0
  const plannedWidth = totals.target > 0 ? (totals.planned / totals.target) * 100 : 0

  return (
    <div
      data-tour="planner-progress"
      className="grid gap-1.5 rounded-[10px] border border-border bg-surface px-3.5 py-2"
    >
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        Progress
      </span>
      {areas.map((area) => {
        const targetEcts = area.capacityEcts ?? area.requiredEcts
        const credited = roundEcts(area.creditedEcts)
        const afterPlanning = roundEcts(area.creditedEcts + area.plannedEcts)
        const targetLabel = targetEcts !== null ? `/${roundEcts(targetEcts)}` : ''
        return (
          <span
            key={area.code}
            title={area.name}
            className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-fg-mid"
          >
            <span
              className={`inline-block h-2 w-2 self-center rounded-xs ${
                (area.masterCat ? CAT_COLOR_CLASS[area.masterCat] : undefined) ?? CAT_COLOR_CLASS.default
              }`}
            />
            <span>{formatRegulationAreaShortLabel(area.code)}</span>
            {area.plannedEcts > 0 ? (
              <>
                <span>{credited}</span>
                <span aria-hidden="true" className="relative -top-px text-[10px] leading-none">
                  →
                </span>
                <span className="font-semibold text-fg">{afterPlanning}</span>
                <span>{targetLabel}</span>
              </>
            ) : (
              <span>{`${credited}${targetLabel}`}</span>
            )}
          </span>
        )
      })}
    </div>

    {totals.target > 0 ? (
      <div
        className="h-1 overflow-hidden rounded-full bg-border-light"
        title={`${roundEcts(totals.credited)} of ${roundEcts(totals.target)} ECTS done${
          totals.planned > 0 ? ` + ${roundEcts(totals.planned)} planned` : ''
        }`}
      >
        <div className="flex h-full">
          <div className="bg-primary/80" style={{ width: `${creditedWidth}%` }} />
          <div className="bg-primary/35" style={{ width: `${plannedWidth}%` }} />
        </div>
      </div>
    ) : null}
    </div>
  )
}
