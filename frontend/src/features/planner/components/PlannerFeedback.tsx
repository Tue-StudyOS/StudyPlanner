import { useMemo } from 'react'
import type { Course } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import { getResolvedPlannerAssignment } from '../utils/plannerAssignments'

interface FulfilledPlannerArea {
  code: string
  name: string
  requiredEcts: number
  earnedEcts: number
  courses: Course[]
}

function buildFulfilledAreas(
  courses: Course[],
  studyProgramCode: string | null,
  planAssignments: Record<string, string>,
  regulationRuleGroups: RegulationRuleGroup[],
): FulfilledPlannerArea[] {
  const ruleGroupByCode = new Map(
    regulationRuleGroups.map((ruleGroup) => [ruleGroup.code, ruleGroup]),
  )
  const areaMap = new Map<string, FulfilledPlannerArea>()

  courses.forEach((course) => {
    const areaCode = getResolvedPlannerAssignment(course, {
      studyProgramCode,
      regulationRuleGroups,
      planAssignments,
      plannedCourses: courses,
      completedCourses: [],
    })
    if (!areaCode) {
      return
    }

    const ruleGroup = ruleGroupByCode.get(areaCode)
    if (!ruleGroup) {
      return
    }

    const areaEntry = areaMap.get(areaCode) ?? {
      code: areaCode,
      name: ruleGroup.name,
      requiredEcts: ruleGroup.requiredEcts ?? 0,
      earnedEcts: 0,
      courses: [],
    }
    areaEntry.earnedEcts += course.ects ?? 0
    areaEntry.courses.push(course)
    areaMap.set(areaCode, areaEntry)
  })

  return [...areaMap.values()]
    .filter((area) => area.requiredEcts > 0 && area.earnedEcts >= area.requiredEcts)
    .sort((left, right) => left.name.localeCompare(right.name))
}

interface PlannerFeedbackProps {
  plannedCourses: Course[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  regulationRuleGroups: RegulationRuleGroup[]
}

export function PlannerFeedback({
  plannedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
}: PlannerFeedbackProps) {
  const totalEcts = useMemo(
    () => plannedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0),
    [plannedCourses],
  )

  const fulfilledAreas = useMemo(
    () =>
      buildFulfilledAreas(
        plannedCourses,
        studyProgramCode,
        planAssignments,
        regulationRuleGroups,
      ),
    [plannedCourses, studyProgramCode, planAssignments, regulationRuleGroups],
  )

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Planned ECTS
        </div>
        <div className="mt-1 text-[30px] font-semibold leading-none text-fg">{totalEcts}</div>
        <div className="mt-1 text-[12px] text-fg-muted">
          {plannedCourses.length} planned course{plannedCourses.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-fg">Fulfilled regulation parts</div>
            <p className="mt-1 text-[12px] text-fg-muted">
              Based only on the courses currently placed in the weekly schedule.
            </p>
          </div>
        </div>

        {!studyProgramCode || regulationRuleGroups.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            Set your study program in Account to see the planner regulation summary.
          </div>
        ) : fulfilledAreas.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            No regulation part is fully covered by the current weekly plan yet.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {fulfilledAreas.map((area) => (
              <div
                key={area.code}
                className="rounded-[10px] border border-border-light bg-surface-hover/35 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[12.5px] font-semibold text-fg">{area.name}</div>
                    <div className="text-[11.5px] text-fg-muted">{area.code}</div>
                  </div>
                  <div className="text-[12px] font-semibold text-fg">
                    {area.earnedEcts}/{area.requiredEcts} ECTS
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {area.courses.map((course) => (
                    <span
                      key={`${area.code}-${course.id}`}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-fg-muted"
                    >
                      {course.title}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
