import { useMemo } from 'react'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { studyAreaCodeToMasterCat } from '../../../shared/utils/regulation'
import { getResolvedPlannerAssignment } from '../utils/plannerAssignments'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}

interface PlannerProgressArea {
  code: string
  name: string
  requiredEcts: number
  creditedEcts: number
  plannedEcts: number
  masterCat: MasterCat | null
  plannedCourseTitles: string[]
}

function colorClass(masterCat: MasterCat | null): string {
  return (masterCat ? CAT_COLOR_CLASS[masterCat] : undefined) ?? CAT_COLOR_CLASS.default
}

function isVisiblePlannerRuleGroup(ruleGroup: RegulationRuleGroup): boolean {
  return ruleGroup.code.trim().toUpperCase() !== 'THESIS'
}

function roundEcts(value: number): number {
  return Math.round(value * 10) / 10
}

function buildPlannerProgressAreas({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
}: {
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
}): PlannerProgressArea[] {
  const areas: PlannerProgressArea[] = regulationRuleGroups
    .filter(isVisiblePlannerRuleGroup)
    .map((ruleGroup) => ({
      code: ruleGroup.code,
      name: ruleGroup.name,
      requiredEcts: ruleGroup.requiredEcts ?? 0,
      creditedEcts: 0,
      plannedEcts: 0,
      masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
      plannedCourseTitles: [],
    }))
  const areaByCode = new Map(areas.map((area) => [area.code, area]))

  completedCourses.forEach((course) => {
    if (!course.studyAreaCode) {
      return
    }
    const area = areaByCode.get(course.studyAreaCode)
    if (!area) {
      return
    }
    area.creditedEcts += course.ects
  })

  const completedCourseIds = new Set(
    completedCourses
      .map((course) => course.courseId)
      .filter((courseId): courseId is string => Boolean(courseId)),
  )

  plannedCourses.forEach((course) => {
    if (completedCourseIds.has(course.id)) {
      return
    }
    const areaCode = getResolvedPlannerAssignment(course, {
      studyProgramCode,
      regulationRuleGroups,
      planAssignments,
      plannedCourses,
      completedCourses,
    })
    if (!areaCode) {
      return
    }
    const area = areaByCode.get(areaCode)
    if (!area) {
      return
    }
    area.plannedEcts += course.ects ?? 0
    area.plannedCourseTitles.push(course.title)
  })

  return areas.filter((area) =>
    area.requiredEcts > 0 || area.creditedEcts > 0 || area.plannedEcts > 0,
  )
}

function buildProgressWidths(area: PlannerProgressArea): {
  creditedWidth: number
  plannedWidth: number
} {
  if (area.requiredEcts <= 0) {
    return { creditedWidth: 0, plannedWidth: 0 }
  }

  const creditedWidth = Math.min(100, (area.creditedEcts / area.requiredEcts) * 100)
  const totalWidth = Math.min(100, ((area.creditedEcts + area.plannedEcts) / area.requiredEcts) * 100)
  return {
    creditedWidth,
    plannedWidth: Math.max(0, totalWidth - creditedWidth),
  }
}

interface PlannerFeedbackProps {
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
}

export function PlannerFeedback({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
}: PlannerFeedbackProps) {
  const totalEcts = useMemo(
    () => plannedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0),
    [plannedCourses],
  )

  const progressAreas = useMemo(
    () =>
      buildPlannerProgressAreas({
        plannedCourses,
        completedCourses,
        studyProgramCode,
        planAssignments,
        regulationRuleGroups,
      }),
    [completedCourses, planAssignments, plannedCourses, regulationRuleGroups, studyProgramCode],
  )

  return (
    <div className="mt-4.5 grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Planned ECTS
        </div>
        <div className="mt-1 text-[30px] font-semibold leading-none text-fg">{roundEcts(totalEcts)}</div>
        <div className="mt-1 text-[12px] text-fg-muted">
          {plannedCourses.length} planned course{plannedCourses.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-fg">Regulation outlook</div>
            <p className="mt-1 text-[12px] text-fg-muted">
              See what is already credited and what this semester plan would add.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-fg-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/80" />
              Credited
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/35" />
              Planned
            </span>
          </div>
        </div>

        {!studyProgramCode || regulationRuleGroups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            Set your study program in Account to see the planner regulation outlook.
          </div>
        ) : progressAreas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            No regulation progress is available for the current plan yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {progressAreas.map((area) => {
              const afterPlanningEcts = roundEcts(area.creditedEcts + area.plannedEcts)
              const { creditedWidth, plannedWidth } = buildProgressWidths(area)

              return (
                <div
                  key={area.code}
                  className={`rounded-[10px] border px-4 py-3 ${area.plannedEcts > 0 ? 'border-primary/25 bg-surface-hover/35' : 'border-border-light bg-surface-hover/20'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-xs ${colorClass(area.masterCat)}`} />
                        <div className="min-w-0 text-[12.5px] font-semibold text-fg">{area.name}</div>
                        <div className="text-[11.5px] text-fg-muted">{area.code}</div>
                      </div>
                      <div className="mt-1 text-[11.5px] text-fg-muted">
                        Current {roundEcts(area.creditedEcts)} ECTS
                        {area.plannedEcts > 0 ? ` · +${roundEcts(area.plannedEcts)} planned` : ''}
                      </div>
                    </div>
                    <div className="text-right text-[12px] font-semibold text-fg">
                      {afterPlanningEcts}/{roundEcts(area.requiredEcts)} ECTS
                    </div>
                  </div>

                  <div className="mt-2 h-2 overflow-hidden rounded-[3px] bg-border-light">
                    <div className="flex h-full w-full overflow-hidden rounded-[3px]">
                      <div
                        className={`${colorClass(area.masterCat)} opacity-90`}
                        style={{ width: `${creditedWidth}%` }}
                      />
                      <div
                        className={`${colorClass(area.masterCat)} opacity-35`}
                        style={{ width: `${plannedWidth}%` }}
                      />
                    </div>
                  </div>

                  {area.plannedCourseTitles.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {area.plannedCourseTitles.map((title, index) => (
                        <span
                          key={`${area.code}-${title}-${index}`}
                          className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-fg-muted"
                        >
                          {title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
