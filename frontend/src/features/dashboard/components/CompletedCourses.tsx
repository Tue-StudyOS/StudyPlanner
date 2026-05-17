import type { CompletedCourse } from '../../courses'
import { CatBadge } from '../../../shared/components/CatBadge'
import { useCompletedCourses } from '../hooks/useCompletedCourses'

interface SemesterTabsProps {
  semesters: string[]
  active: string
  onSelect: (semester: string) => void
}

interface CompletedCourseRowProps {
  course: CompletedCourse
  index: number
  isLast: boolean
}

function SemesterTabs({ semesters, active, onSelect }: SemesterTabsProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {semesters.map((semester) => {
        const isActive = semester === active
        return (
          <button
            key={semester}
            type="button"
            onClick={() => onSelect(semester)}
            className={`rounded-full border px-3 py-1.25 text-[12px] font-medium transition-colors ${
              isActive
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-transparent text-fg-mid'
            }`}
          >
            {semester}
          </button>
        )
      })}
    </div>
  )
}

function CompletedCourseRow({ course, index, isLast }: CompletedCourseRowProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${
        index % 2 === 0 ? 'bg-surface' : 'bg-row-alt'
      } ${isLast ? '' : 'border-b border-border-light'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-fg">{course.title}</div>
        <div className="text-[11px] text-fg-muted">
          {course.semester} · {course.ects} ECTS
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {course.masterCats.map((cat) => (
          <CatBadge key={cat} cat={cat} />
        ))}
      </div>
      <span className="min-w-6 shrink-0 text-right text-[16px] font-bold text-fg">
        {course.grade}
      </span>
    </div>
  )
}

export function CompletedCourses() {
  const { semesters, activeSemester, setActiveSemester, courses } = useCompletedCourses()

  return (
    <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[14px] font-semibold text-fg">Completed Courses</div>
        <SemesterTabs semesters={semesters} active={activeSemester} onSelect={setActiveSemester} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        {courses.length === 0 ? (
          <div className="px-6 py-6 text-center text-[13px] text-fg-muted">
            No courses in this semester.
          </div>
        ) : (
          courses.map((course, index) => (
            <CompletedCourseRow
              key={course.id}
              course={course}
              index={index}
              isLast={index === courses.length - 1}
            />
          ))
        )}
      </div>
    </div>
  )
}
