import { useMemo } from 'react'
import type { Course, StudyAreaOption } from '../../courses'

interface CoverageItem {
  key: string
  label: string
  courseCount: number
  ects: number
}

function getAssignableOptions(
  course: Course,
  studyProgramCode: string | null,
): Array<{ code: string; label: string }> {
  const options = course.studyAreaOptions ?? []
  const filtered = options.filter((o) => !studyProgramCode || o.programCode === studyProgramCode)
  const relevant = filtered.length > 0 ? filtered : options
  const seen = new Set<string>()
  return relevant
    .filter((o): o is StudyAreaOption & { studyAreaCode: string } => Boolean(o.studyAreaCode))
    .map((o) => ({ code: o.studyAreaCode, label: o.studyAreaName || o.studyAreaCode }))
    .filter((o) => {
      if (seen.has(o.code)) {
        return false
      }
      seen.add(o.code)
      return true
    })
}

function buildCoverage(
  courses: Course[],
  studyProgramCode: string | null,
  planAssignments: Record<string, string>,
): CoverageItem[] {
  const byKey = new Map<string, CoverageItem>()

  courses.forEach((course) => {
    const manualCode = planAssignments[course.id]
    if (manualCode) {
      const label =
        course.studyAreaOptions?.find((o) => o.studyAreaCode === manualCode)?.studyAreaName ||
        manualCode
      const item = byKey.get(manualCode) ?? { key: manualCode, label, courseCount: 0, ects: 0 }
      item.courseCount += 1
      item.ects += course.ects ?? 0
      byKey.set(manualCode, item)
      return
    }

    const options = course.studyAreaOptions ?? []
    const filtered = options.filter((o) => !studyProgramCode || o.programCode === studyProgramCode)
    const relevant = filtered.length > 0 ? filtered : options
    const seen = new Set<string>()

    relevant.forEach((o) => {
      const key = o.studyAreaCode || o.studyAreaName
      if (!key || seen.has(key)) {
        return
      }
      seen.add(key)
      const item = byKey.get(key) ?? {
        key,
        label: o.studyAreaName || key,
        courseCount: 0,
        ects: 0,
      }
      item.courseCount += 1
      item.ects += course.ects ?? 0
      byKey.set(key, item)
    })
  })

  return [...byKey.values()].sort(
    (a, b) => b.ects - a.ects || a.label.localeCompare(b.label),
  )
}

interface PlannerFeedbackProps {
  plannedCourses: Course[]
  studyProgramCode: string | null
  planAssignments: Record<string, string>
  isEditing: boolean
  onSetAssignment: (courseId: string, areaCode: string | null) => void
}

export function PlannerFeedback({
  plannedCourses,
  studyProgramCode,
  planAssignments,
  isEditing,
  onSetAssignment,
}: PlannerFeedbackProps) {
  const totalEcts = useMemo(
    () => plannedCourses.reduce((sum, c) => sum + (c.ects ?? 0), 0),
    [plannedCourses],
  )

  const coverageItems = useMemo(
    () => buildCoverage(plannedCourses, studyProgramCode, planAssignments),
    [plannedCourses, studyProgramCode, planAssignments],
  )

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[10px] border border-border bg-surface px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Planned ECTS
        </div>
        <div className="mt-1 text-[28px] font-semibold leading-none text-fg">{totalEcts}</div>
        <div className="mt-1 text-[12px] text-fg-muted">
          {plannedCourses.length} course{plannedCourses.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="rounded-[10px] border border-border bg-surface px-4 py-4">
        <div className="mb-3 text-[13px] font-semibold text-fg">Block coverage</div>
        {!studyProgramCode ? (
          <div className="mb-3 rounded-md border border-border-light bg-surface-hover/60 px-3 py-2 text-[12px] text-fg-muted">
            Set your study program in Account for program-specific blocks.
          </div>
        ) : null}
        {coverageItems.length === 0 ? (
          <div className="text-[12.5px] text-fg-muted">
            Add courses to see block coverage.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {coverageItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-2 rounded-md border border-border-light bg-surface-hover/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-fg">{item.label}</div>
                  <div className="text-[11.5px] text-fg-muted">
                    {item.courseCount} course{item.courseCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="shrink-0 text-[13px] font-semibold text-fg">
                  {item.ects} ECTS
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditing && plannedCourses.length > 0 ? (
        <div className="rounded-[10px] border border-border bg-surface px-4 py-4">
          <div className="mb-3 text-[13px] font-semibold text-fg">Block assignment</div>
          <p className="mb-3 text-[12px] text-fg-muted">
            Set which regulation block each course counts toward.
          </p>
          <div className="flex flex-col gap-2">
            {plannedCourses.map((course) => {
              const options = getAssignableOptions(course, studyProgramCode)
              const currentValue = planAssignments[course.id] ?? ''
              return (
                <div key={course.id} className="rounded-md border border-border-light bg-surface-hover/40 px-3 py-2">
                  <div className="mb-1.5 truncate text-[12px] font-medium text-fg">
                    {course.title}
                  </div>
                  {options.length === 0 ? (
                    <div className="text-[11.5px] text-fg-muted">No regulation blocks found</div>
                  ) : (
                    <select
                      value={currentValue}
                      onChange={(e) =>
                        onSetAssignment(course.id, e.target.value || null)
                      }
                      className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-[12px] text-fg outline-none focus:border-primary"
                    >
                      <option value="">Auto-detect</option>
                      {options.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}
