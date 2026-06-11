import { useMemo } from 'react'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import type { RegulationAreaOption, RegulationRuleGroup } from '../../../shared/utils/regulation'
import { getEffectiveRuleGroupCapacity, studyAreaCodeToMasterCat } from '../../../shared/utils/regulation'
import { RegulationAreasInfo } from '../../../shared/components/RegulationAreasInfo'
import {
  getPlannerCourseAreaOptions,
  getPlannerCourseEctsForArea,
  resolveAutomaticPlannerAssignments,
  type PlannerAutomaticAssignmentCandidate,
} from '../utils/plannerAssignments'

const CAT_COLOR_CLASS: Partial<Record<MasterCat, string>> & { default: string } = {
  TECH: 'bg-cat-tech',
  THEO: 'bg-cat-theo',
  PRAK: 'bg-cat-prak',
  INFO: 'bg-cat-info',
  BASIS: 'bg-cat-basis',
  default: 'bg-border',
}
const EDIT_REQUIRED_HINT = 'Click "Edit semester" first to add courses to your plan.'
const ASSIGNMENT_CONTROL_GROUP_CLASS =
  'flex w-full flex-wrap items-center justify-end gap-1.5 sm:w-[18rem] sm:shrink-0 sm:flex-nowrap'
const ASSIGNMENT_SELECT_CLASS =
  'min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] text-fg outline-none focus:border-primary'

interface PlannerProgressArea {
  code: string
  name: string
  requiredEcts: number | null
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

function getRuleGroupRequiredEcts(ruleGroup: RegulationRuleGroup): number | null {
  return ruleGroup.requiredEcts ?? ruleGroup.minEcts ?? ruleGroup.maxEcts ?? null
}

function buildFallbackArea(option: RegulationAreaOption): PlannerProgressArea {
  return {
    code: option.code,
    name: option.label,
    requiredEcts: null,
    capacityEcts: null,
    creditedEcts: 0,
    plannedEcts: 0,
    masterCat: option.masterCat,
    plannedCourses: [],
  }
}

function RemovePlannerCourseButton({
  courseTitle,
  isEditing,
  onRemove,
}: {
  courseTitle: string
  isEditing: boolean
  onRemove: () => void
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      disabled={!isEditing}
      aria-label={`Remove ${courseTitle} from semester plan`}
      title={isEditing ? 'Remove from semester plan' : EDIT_REQUIRED_HINT}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-fg-muted transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-fg-muted"
    >
      <svg aria-hidden="true" viewBox="0 0 12 12" className="h-2.5 w-2.5">
        <path
          d="M3 3l6 6M9 3L3 9"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        />
      </svg>
    </button>
  )
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
      requiredEcts: getRuleGroupRequiredEcts(ruleGroup),
      capacityEcts: getEffectiveRuleGroupCapacity(ruleGroup),
      creditedEcts: 0,
      plannedEcts: 0,
      masterCat: studyAreaCodeToMasterCat(ruleGroup.code),
      plannedCourses: [],
    }))
  const areaByCode = new Map(areas.map((area) => [area.code, area]))
  const unassignedCourses: UnassignedPlannerCourse[] = []
  const automaticCandidates: PlannerAutomaticAssignmentCandidate[] = []

  if (areas.length === 0) {
    plannedCourses.forEach((course) => {
      getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups).forEach((option) => {
        if (!areaByCode.has(option.code)) {
          const area = buildFallbackArea(option)
          areas.push(area)
          areaByCode.set(area.code, area)
        }
      })
    })
  }

  completedCourses.forEach((course) => {
    if (!course.studyAreaCode) {
      return
    }
    let area = areaByCode.get(course.studyAreaCode)
    if (!area && regulationRuleGroups.length === 0) {
      area = {
        code: course.studyAreaCode,
        name: course.studyAreaName ?? course.studyAreaCode,
        requiredEcts: null,
        capacityEcts: null,
        creditedEcts: 0,
        plannedEcts: 0,
        masterCat: course.masterCat,
        plannedCourses: [],
      }
      areas.push(area)
      areaByCode.set(area.code, area)
    }
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

  plannedCourses.forEach((course, index) => {
    if (completedCourseIds.has(course.id)) {
      return
    }

    const options = getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups)
    const preferredAreaCode = planAssignments[course.id]
    const manualOption = preferredAreaCode
      ? options.find((option) => option.code === preferredAreaCode)
      : undefined

    if (manualOption) {
      const area = areaByCode.get(manualOption.code)
      if (!area) {
        const courseEcts = getPlannerCourseEctsForArea(course, manualOption.code, studyProgramCode)
        unassignedCourses.push({
          id: course.id,
          title: course.title,
          ects: courseEcts,
          options,
        })
        return
      }
      const courseEcts = getPlannerCourseEctsForArea(course, manualOption.code, studyProgramCode)
      area.plannedEcts += courseEcts
      area.plannedCourses.push({
        id: course.id,
        title: course.title,
        ects: courseEcts,
        assignedAreaCode: manualOption.code,
        options,
      })
      return
    }

    if (options.length === 0) {
      unassignedCourses.push({
        id: course.id,
        title: course.title,
        ects: course.ects ?? 0,
        options,
      })
      return
    }

    automaticCandidates.push({
      course,
      index,
      options,
    })
  })

  const automaticAssignments = resolveAutomaticPlannerAssignments({
    candidates: automaticCandidates,
    areas,
    regulationRuleGroups,
    studyProgramCode,
  })

  automaticCandidates.forEach(({ course, options }) => {
    const automaticAssignment = automaticAssignments.get(course.id)
    if (!automaticAssignment) {
      unassignedCourses.push({
        id: course.id,
        title: course.title,
        ects: course.ects ?? 0,
        options,
      })
      return
    }

    const area = areaByCode.get(automaticAssignment.areaCode)
    if (!area) {
      unassignedCourses.push({
        id: course.id,
        title: course.title,
        ects: automaticAssignment.ects,
        options,
      })
      return
    }
    area.plannedEcts += automaticAssignment.ects
    area.plannedCourses.push({
      id: course.id,
      title: course.title,
      ects: automaticAssignment.ects,
      assignedAreaCode: automaticAssignment.areaCode,
      options,
    })
  })

  return {
    areas,
    unassignedCourses,
  }
}

function buildProgressWidths(area: PlannerProgressArea): {
  creditedWidth: number
  plannedWidth: number
} {
  const targetEcts = area.capacityEcts ?? area.requiredEcts
  if (targetEcts === null || targetEcts <= 0) {
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
  isLoadingRegulationVersion: boolean
  isEditing: boolean
  isBalancing: boolean
  balanceMessage: string | null
  onSetAssignments: (assignments: Record<string, string>) => void
  onRemoveCourse: (courseId: string) => void
  onAutoBalance: () => Promise<void>
}

export function PlannerFeedback({
  plannedCourses,
  completedCourses,
  studyProgramCode,
  planAssignments,
  regulationRuleGroups,
  isLoadingRegulationVersion,
  isEditing,
  isBalancing,
  balanceMessage,
  onSetAssignments,
  onRemoveCourse,
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
  const handleManualAssignmentChange = (courseId: string, areaCode: string | null): void => {
    const nextAssignments = { ...planAssignments }

    progressAreas.forEach((area) => {
      area.plannedCourses.forEach((course) => {
        nextAssignments[course.id] = course.assignedAreaCode
      })
    })

    if (areaCode) {
      nextAssignments[courseId] = areaCode
    } else {
      delete nextAssignments[courseId]
    }

    onSetAssignments(nextAssignments)
  }

  return (
    <div className="rounded-[10px] border border-border bg-surface px-5 py-4.5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[14px] font-semibold text-fg">Regulation Outlook</div>
              <RegulationAreasInfo />
            </div>
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
                className="rounded-md bg-primary px-4 py-2.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
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

        {isLoadingRegulationVersion ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            Loading the active regulation outlook...
          </div>
        ) : progressAreas.length === 0 && unassignedCourses.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
            {studyProgramCode
              ? 'No regulation progress is available for the current plan yet.'
              : 'Set your study program in Account for the official PO outlook, or add mapped courses here to preview their selected areas.'}
          </div>
        ) : (
          <div className="grid gap-3">
            {progressAreas.map((area) => {
              const afterPlanningEcts = roundEcts(area.creditedEcts + area.plannedEcts)
              const { creditedWidth, plannedWidth } = buildProgressWidths(area)
              const targetEcts = area.capacityEcts ?? area.requiredEcts
              const overCapacityEcts = targetEcts !== null && targetEcts > 0
                ? Math.max(0, afterPlanningEcts - targetEcts)
                : 0
              const targetLabel = targetEcts === null ? 'open' : roundEcts(targetEcts)

              return (
                <div
                  key={area.code}
                  className={`rounded-[10px] border px-4 py-3 ${
                    overCapacityEcts > 0
                      ? 'border-primary/40 bg-primary/5'
                      : area.plannedEcts > 0
                        ? 'border-border bg-surface-hover/35'
                        : 'border-border-light bg-surface-hover/20'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-xs ${colorClass(area.masterCat)}`} />
                        <div className="text-[12.5px] font-semibold text-fg">{area.code}</div>
                        <div className="min-w-0 truncate text-[11.5px] text-fg-muted">{area.name}</div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[12px] font-semibold text-fg">
                      {afterPlanningEcts}/{targetLabel} ECTS
                    </div>
                  </div>

                  <div className="mt-1 text-[11.5px] text-fg-muted">
                    Current {roundEcts(area.creditedEcts)} ECTS
                    {area.plannedEcts > 0 ? ` + ${roundEcts(area.plannedEcts)} planned` : ''}
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
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-hover/70 px-3 py-2 text-[11px] text-fg-muted shadow-sm"
                        >
                          <span className="min-w-0 flex-1 break-words font-semibold text-fg">
                            {course.title} - {roundEcts(course.ects)} ECTS
                          </span>
                          <div className={ASSIGNMENT_CONTROL_GROUP_CLASS}>
                            {isEditing && course.options.length > 1 ? (
                              <select
                                value={course.assignedAreaCode}
                                onChange={(event) =>
                                  handleManualAssignmentChange(course.id, event.target.value)
                                }
                                className={ASSIGNMENT_SELECT_CLASS}
                              >
                                {course.options.map((option) => (
                                  <option key={option.code} value={option.code}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="min-w-0 flex-1 truncate rounded-full border border-border bg-surface px-2 py-0.5 text-center text-[10px] font-semibold text-fg-muted">
                                {course.assignedAreaCode}
                              </span>
                            )}
                            <RemovePlannerCourseButton
                              courseTitle={course.title}
                              isEditing={isEditing}
                              onRemove={() => onRemoveCourse(course.id)}
                            />
                          </div>
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
                      <div className={ASSIGNMENT_CONTROL_GROUP_CLASS}>
                        {isEditing && course.options.length > 0 ? (
                          <select
                            value=""
                            onChange={(event) =>
                              handleManualAssignmentChange(course.id, event.target.value)
                            }
                            className={ASSIGNMENT_SELECT_CLASS}
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
                        <RemovePlannerCourseButton
                          courseTitle={course.title}
                          isEditing={isEditing}
                          onRemove={() => onRemoveCourse(course.id)}
                        />
                      </div>
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
