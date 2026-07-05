import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses/utils/courseTitle.ts'
import { AreaBadge } from '../../../shared/components/AreaBadge'
import { buildCourseAreaTags } from '../../courses/utils/courseCardDisplay.ts'

interface PastSemesterCourseListProps {
  courses: Course[]
  studyProgramCode: string | null
  assignments: Record<string, string>
}

export function PastSemesterCourseList({
  courses,
  studyProgramCode,
  assignments,
}: PastSemesterCourseListProps) {
  if (courses.length === 0) {
    return null
  }

  const totalEcts = courses.reduce((sum, course) => sum + (course.ects ?? 0), 0)

  return (
    <section className="rounded-[10px] border border-border bg-surface px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-fg">Courses this semester</h2>
        <span className="text-[12px] text-fg-muted">
          <span className="font-semibold text-fg">{totalEcts}</span> ECTS · {courses.length} course{courses.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {courses.map((course) => {
          const areaTags = buildCourseAreaTags(course, studyProgramCode)
          const assignedAreaCode = assignments[course.id]
          const assignedTag = assignedAreaCode
            ? areaTags.find((tag) => tag.key === assignedAreaCode) ?? { key: assignedAreaCode, label: assignedAreaCode, masterCat: null }
            : null
          return (
            <li
              key={course.id}
              className="min-w-0 rounded-md border border-border-light bg-surface-hover/20 px-3 py-2.5"
            >
              <div className="break-words text-[13px] font-semibold leading-snug text-fg">
                {cleanCourseTitle(course.title, course.number)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {course.ects !== null ? (
                  <span className="text-[11px] font-medium text-fg-muted">{course.ects} ECTS</span>
                ) : null}
                {assignedTag ? (
                  <AreaBadge label={assignedTag.label} masterCat={assignedTag.masterCat} />
                ) : null}
                {areaTags
                  .filter((tag) => tag.key !== assignedAreaCode)
                  .map((tag) => (
                    <AreaBadge key={tag.key} label={tag.label} masterCat={tag.masterCat} />
                  ))}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
