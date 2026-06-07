import { useMemo } from 'react'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { getEffectiveRuleGroupCapacity, studyAreaCodeToMasterCat } from '../../../shared/utils/regulation'
import { getPlannerCourseAreaOptions } from '../utils/plannerAssignments'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}
const EDIT_REQUIRED_HINT = 'Click "Edit semester" first to add courses to your plan.'

interface PlannerProgressArea {
  code: string
  name: string
  requiredEcts: number
  capacityEcts: number | null
  creditedEcts: number
  plannedEcts: number
  masterCat: MasterCat | null
  plannedCourses: PlannerProgressCourse[]
}

interface PlannerProgressCourse {
  id: string
  title: string
  ects: number
  assignedAreaCode: string
  options: RegulationAreaOption[]
}

interface UnassignedPlannerCourse {
  id: string
  title: string
  ects: number
  options: RegulationAreaOption[]
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

function canAddCourseToArea(area: PlannerProgressArea, courseEcts: number): boolean {
  const capacityEcts = area.capacityEcts
  return capacityEcts === null || area.creditedEcts + area.plannedEcts + courseEcts <= capacityEcts
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
}): {
  areas: PlannerProgressArea[]
  unassignedCourses: UnassignedPlannerCourse[]
} {
  const areas: PlannerProgressArea[] = regulationRuleGroups
    .filter(isVisiblePlannerRuleGroup)
    .map((ruleGroup) => ({
      code: ruleGroup.code,
      name: ruleGroup.name,
      requiredEcts: ruleGroup.requiredEcts ?? 0,
      capacityEcts: getEffectiveRuleGroupCapacity(ruleGroup),
      creditedEcts: 0,
      plannedEcts: 0,
      masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
      plannedCourses: [],
    }))
  const areaByCode = new Map(areas.map((area) => [area.code, area]))
  const unassignedCourses: UnassignedPlannerCourse[] = []

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

  const plannedCourseCandidates = plannedCourses
    .map((course, index) => ({
      course,
      index,
      options: getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups),
    }))
    .sort((left, right) => {
      const leftOptionCount = left.options.length || Number.POSITIVE_INFINITY
      const rightOptionCount = right.options.length || Number.POSITIVE_INFINITY
      return leftOptionCount - rightOptionCount || left.index - right.index
    })

  plannedCourseCandidates.forEach(({ course, options }) => {
    if (completedCourseIds.has(course.id)) {
      return
    }

    const courseEcts = course.ects ?? 0
    const preferredAreaCode = planAssignments[course.id]
    const manualOption = preferredAreaCode
      ? options.find((option) => option.code === preferredAreaCode)
      : undefined
    const selectedOption = manualOption ?? [...options].sort((left, right) =>
      left.label.localeCompare(right.label),
    ).find((option) => {
      const area = areaByCode.get(option.code)
      return area ? canAddCourseToArea(area, courseEcts) : false
    })

    if (!selectedOption) {
      unassignedCourses.push({
        id: course.id,
        title: course.title,
        ects: courseEcts,
        options,
      })
      return
    }

    const area = areaByCode.get(selectedOption.code)
    if (!area) {
      unassignedCourses.push({
        id: course.id,
        title: course.title,
        ects: courseEcts,
        options,
      })
      return
    }
    area.plannedEcts += courseEcts
    area.plannedCourses.push({
      id: course.id,
      title: course.title,
      ects: courseEcts,
      assignedAreaCode: selectedOption.code,
      options,
    })
  })

  return {
    areas: areas.filter((area) =>
      area.requiredEcts > 0 || area.creditedEcts > 0 || area.plannedEcts > 0,
    ),
    unassignedCourses,
  }
}

function buildProgressWidths(area: PlannerProgressArea): {
  creditedWidth: number
  plannedWidth: number
} {
  if (area.requiredEcts <= 0) {
    return { creditedWidth: 0, plannedWidth: 0 }
  }

  const targetEcts = area.capacityEcts ?? area.requiredEcts
  if (targetEcts <= 0) {
    return { creditedWidth: 0, plannedWidth: 0 }
  }

  const creditedWidth = Math.min(100, (area.creditedEcts / targetEcts) * 100)
  const totalWidth = Math.min(100, ((area.creditedEcts + area.plannedEcts) / targetEcts) * 100)
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
  isEditing: boolean
  isBalancing: boolean
  balanceMessage: string | null
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onAutoBalance: () => Promise<void>
}

export function PlannerFeedback({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
  isEditing,
  isBalancing,
  balanceMessage,
  onSetAssignment,
  onAutoBalance,
}: PlannerFeedbackProps) {
  const totalEcts = useMemo(
    () => plannedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0),
    [plannedCourses],
  )

  const progressOutlook = useMemo(
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
  const progressAreas = progressOutlook.areas
  const unassignedCourses = progressOutlook.unassignedCourses

  return (
    <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-fg">Regulation outlook</div>
            <p className="mt-1 text-[12px] text-fg-muted">
              See what is already credited and what this semester plan would add.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
              <span className="font-semibold text-fg">{roundEcts(totalEcts)} ECTS planned</span>
              <span>
                {plannedCourses.length} planned course{plannedCourses.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="group/btn relative inline-flex">
              <button
                type="button"
                onClick={() => void onAutoBalance()}
                disabled={!isEditing || isBalancing || plannedCourses.length === 0}
                className="rounded-md bg-primary px-4 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isBalancing ? 'Balancing...' : 'Balance planner'}
              </button>
              {!isEditing ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-48 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium leading-snug text-fg-muted opacity-0 shadow-md transition-opacity duration-150 group-hover/btn:opacity-100"
                >
                  {EDIT_REQUIRED_HINT}
                </span>
              ) : null}
            </span>
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
        </div>

        {balanceMessage ? (
          <div className="mb-3 rounded-md border border-border-light bg-surface-hover/35 px-4 py-2.5 text-[12px] text-fg-muted">
            {balanceMessage}
          </div>
        ) : null}

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
              const targetEcts = area.capacityEcts ?? area.requiredEcts
              const overCapacityEcts = targetEcts > 0
                ? Math.max(0, afterPlanningEcts - targetEcts)
                : 0

              return (
                <div
                  key={area.code}
                  className={`rounded-[10px] border px-4 py-3 ${
                    overCapacityEcts > 0
                      ? 'border-primary/40 bg-primary/5'
                      : area.plannedEcts > 0
                        ? 'border-primary/25 bg-surface-hover/35'
                        : 'border-border-light bg-surface-hover/20'
                  }`}
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
                        {area.plannedEcts > 0 ? ` - +${roundEcts(area.plannedEcts)} planned` : ''}
                      </div>
                    </div>
                    <div className="text-right text-[12px] font-semibold text-fg">
                      {afterPlanningEcts}/{roundEcts(targetEcts)} ECTS
                    </div>
                  </div>

                  {overCapacityEcts > 0 ? (
                    <div className="mt-2 text-[11.5px] font-medium text-primary">
                      Over capacity by {roundEcts(overCapacityEcts)} ECTS.
                    </div>
                  ) : null}

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

                  {area.plannedCourses.length > 0 ? (
                    <div className="mt-2 grid gap-1.5">
                      {area.plannedCourses.map((course) => (
                        <div
                          key={`${area.code}-${course.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-[11px] text-fg-muted"
                        >
                          <span className="min-w-0 flex-1 break-words">
                            {course.title} - {roundEcts(course.ects)} ECTS
                          </span>
                          {isEditing && course.options.length > 1 ? (
                            <select
                              value={course.assignedAreaCode}
                              onChange={(event) => onSetAssignment(course.id, event.target.value)}
                              className="max-w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-fg outline-none focus:border-primary"
                            >
                              {course.options.map((option) => (
                                <option key={option.code} value={option.code}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-fg-muted">
                              {course.assignedAreaCode}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}

            {unassignedCourses.length > 0 ? (
              <div className="rounded-[10px] border border-primary/35 bg-primary/5 px-4 py-3">
                <div className="text-[12.5px] font-semibold text-primary">Needs assignment</div>
                <p className="mt-1 text-[11.5px] text-fg-muted">
                  These planned courses either have no compatible regulation mapping or no area with
                  enough remaining ECTS capacity.
                </p>
                <div className="mt-2 grid gap-1.5">
                  {unassignedCourses.map((course) => (
                    <div
                      key={course.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] text-fg-muted"
                    >
                      <span className="min-w-0 flex-1 break-words">
                        {course.title} - {roundEcts(course.ects)} ECTS
                      </span>
                      {isEditing && course.options.length > 0 ? (
                        <select
                          value=""
                          onChange={(event) => onSetAssignment(course.id, event.target.value)}
                          className="max-w-full rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-fg outline-none focus:border-primary"
                        >
                          <option value="" disabled>
                            Choose area
                          </option>
                          {course.options.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span>No compatible area</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
  )
}
