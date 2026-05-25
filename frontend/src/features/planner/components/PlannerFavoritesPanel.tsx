import { useMemo, useState } from 'react'
import type { CompletedCourse, Course } from '../../courses'
import type { RegulationRuleGroup } from '../../../shared/utils/regulation'
import {
  getPlannerCourseAreaOptions,
  getResolvedPlannerAssignment,
  getSuggestedPlannerAssignment,
} from '../utils/plannerAssignments'

function AssignmentSelect({
  course,
  selectedAreaCode,
  suggestedAreaCode,
  isPlanned,
  studyProgramCode,
  regulationRuleGroups,
  onSelectAssignment,
}: {
  course: Course
  selectedAreaCode: string | null
  suggestedAreaCode: string | null
  isPlanned: boolean
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  onSelectAssignment: (areaCode: string | null) => void
}) {
  const options = getPlannerCourseAreaOptions(course, studyProgramCode, regulationRuleGroups)

  if (options.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-2 text-[11px] text-fg-muted">
        No regulation target found for this course yet.
      </div>
    )
  }

  if (options.length === 1) {
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-[11.5px] text-fg-muted">
        Counts as <span className="font-semibold text-fg">{options[0].label}</span>
      </div>
    )
  }

  return (
    <label className="grid gap-1">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        Counts as
      </span>
      <select
        value={selectedAreaCode ?? ''}
        onChange={(event) => onSelectAssignment(event.target.value || null)}
        className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
            {!isPlanned && suggestedAreaCode === option.code ? ' · suggested' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

function CandidateCard({
  course,
  isPlanned,
  selectedAreaCode,
  suggestedAreaCode,
  studyProgramCode,
  regulationRuleGroups,
  onSelectAssignment,
  onAddCourse,
  onRemoveCourse,
}: {
  course: Course
  isPlanned: boolean
  selectedAreaCode: string | null
  suggestedAreaCode: string | null
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  onSelectAssignment: (areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onRemoveCourse: (courseId: string) => void
}) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/planner-course-id', course.id)
        event.dataTransfer.setData('text/planner-area-code', selectedAreaCode ?? '')
        event.dataTransfer.effectAllowed = 'move'
      }}
      className="cursor-grab rounded-[10px] border border-border-light bg-surface px-4 py-3 transition-colors hover:bg-surface-hover active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="break-words text-[13px] font-semibold text-fg">{course.title}</div>
          <div className="break-words text-[12px] text-fg-muted">
            {course.number} · {course.ects ?? '–'} ECTS
          </div>
          <div className="mt-1 break-words text-[11px] text-fg-muted">
            {course.schedule.at(0)?.day ?? 'Day tba'} · {course.schedule.at(0)?.time ?? 'Time tba'}
          </div>
        </div>

        <button
          type="button"
          onClick={() => (isPlanned ? onRemoveCourse(course.id) : onAddCourse(course.id, selectedAreaCode))}
          className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors ${
            isPlanned
              ? 'border border-border bg-surface text-fg hover:bg-surface-hover'
              : 'bg-primary text-white hover:opacity-90'
          }`}
        >
          {isPlanned ? 'Remove' : 'Add'}
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <AssignmentSelect
          course={course}
          selectedAreaCode={selectedAreaCode}
          suggestedAreaCode={suggestedAreaCode}
          isPlanned={isPlanned}
          studyProgramCode={studyProgramCode}
          regulationRuleGroups={regulationRuleGroups}
          onSelectAssignment={onSelectAssignment}
        />

        {suggestedAreaCode && !isPlanned ? (
          <div className="text-[11px] text-fg-muted">
            Suggested automatically from your remaining regulation needs and already credited courses.
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface PlannerFavoritesPanelProps {
  favoriteCourses: Course[]
  plannedCourseIds: string[]
  activeSemesterLabel: string
  isLoading: boolean
  error: string | null
  studyProgramCode: string | null
  regulationRuleGroups: RegulationRuleGroup[]
  planAssignments: Record<string, string>
  plannedCourses: Course[]
  completedCourses: CompletedCourse[]
  onSetAssignment: (courseId: string, areaCode: string | null) => void
  onAddCourse: (courseId: string, areaCode: string | null) => void
  onRemoveCourse: (courseId: string) => void
}

export function PlannerFavoritesPanel({
  favoriteCourses,
  plannedCourseIds,
  activeSemesterLabel,
  isLoading,
  error,
  studyProgramCode,
  regulationRuleGroups,
  planAssignments,
  plannedCourses,
  completedCourses,
  onSetAssignment,
  onAddCourse,
  onRemoveCourse,
}: PlannerFavoritesPanelProps) {
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({})

  const sortedFavoriteCourses = useMemo(
    () =>
      [...favoriteCourses].sort((leftCourse, rightCourse) => {
        const leftIsPlanned = plannedCourseIds.includes(leftCourse.id)
        const rightIsPlanned = plannedCourseIds.includes(rightCourse.id)
        if (leftIsPlanned !== rightIsPlanned) {
          return Number(rightIsPlanned) - Number(leftIsPlanned)
        }
        return leftCourse.title.localeCompare(rightCourse.title)
      }),
    [favoriteCourses, plannedCourseIds],
  )

  function getSuggestedAreaCode(course: Course): string | null {
    return getSuggestedPlannerAssignment(course, {
      studyProgramCode,
      regulationRuleGroups,
      planAssignments,
      plannedCourses,
      completedCourses,
    })
  }

  function getSelectedAreaCode(course: Course, isPlanned: boolean): string | null {
    const draftValue = assignmentDrafts[course.id]
    if (draftValue) {
      return draftValue
    }
    if (isPlanned) {
      return getResolvedPlannerAssignment(course, {
        studyProgramCode,
        regulationRuleGroups,
        planAssignments,
        plannedCourses,
        completedCourses,
      })
    }
    return getSuggestedAreaCode(course)
  }

  return (
    <aside className="overflow-hidden rounded-[10px] border border-border bg-surface lg:h-[44rem]">
      <div className="border-b border-border px-6 py-5.5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border bg-surface-hover/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            Favorites picker
          </div>
          <div className="text-[11.5px] text-fg-muted">{favoriteCourses.length} favorite(s)</div>
          <div className="text-[11.5px] text-fg-muted">{plannedCourseIds.length} already planned</div>
        </div>
        <p className="text-[12.5px] text-fg-muted">
          Add or remove favorites for {activeSemesterLabel} and choose directly what each course should count as.
        </p>
      </div>

      <div className="max-h-[26rem] overflow-y-auto bg-surface-hover/30 px-6 py-4 lg:h-[calc(44rem-89px)] lg:max-h-none">
        {isLoading ? (
          <div className="text-[13px] text-fg-muted">Loading your favorite course candidates...</div>
        ) : error ? (
          <div className="text-[13px] text-primary">Failed to load planner candidates. {error}</div>
        ) : sortedFavoriteCourses.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-fg-muted">
            Add some favorites in the catalog first, then come back here to plan with them.
          </div>
        ) : (
          <div className="grid gap-2.5">
            {sortedFavoriteCourses.map((course) => {
              const isPlanned = plannedCourseIds.includes(course.id)
              const suggestedAreaCode = getSuggestedAreaCode(course)
              const selectedAreaCode = getSelectedAreaCode(course, isPlanned)

              return (
                <CandidateCard
                  key={course.id}
                  course={course}
                  isPlanned={isPlanned}
                  selectedAreaCode={selectedAreaCode}
                  suggestedAreaCode={suggestedAreaCode}
                  studyProgramCode={studyProgramCode}
                  regulationRuleGroups={regulationRuleGroups}
                  onSelectAssignment={(areaCode) => {
                    if (isPlanned) {
                      onSetAssignment(course.id, areaCode)
                    }
                    setAssignmentDrafts((previousValue) => {
                      if (!areaCode) {
                        const nextValue = { ...previousValue }
                        delete nextValue[course.id]
                        return nextValue
                      }
                      return { ...previousValue, [course.id]: areaCode }
                    })
                  }}
                  onAddCourse={onAddCourse}
                  onRemoveCourse={onRemoveCourse}
                />
              )
            })}
          </div>
        )}
      </div>
    </aside>
  )
}
