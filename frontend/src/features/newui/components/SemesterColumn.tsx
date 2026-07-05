import type { Course } from '../../courses'
import { cleanCourseTitle } from '../../courses'
import { formatSemesterLabelDisplay } from '../../planner/utils/semesterLabels'
import type { CategoryControl } from '../hooks/useBetaPlanner'
import type { SemesterGroup } from '../types'
import { formatGrade } from '../utils/studyPlanOverview'
import { CategoryTag } from './CategoryTag'
import { CourseCategoryDropdown } from './CourseCategoryDropdown'

interface SemesterColumnProps {
  semester: SemesterGroup
  /** Courses planned for the open (current) semester — shown only there. */
  plannedCourses?: Course[]
  categoryControl?: CategoryControl
  onRemovePlanned?: (courseId: string) => void
}

export function SemesterColumn({
  semester,
  plannedCourses = [],
  categoryControl,
  onRemovePlanned,
}: SemesterColumnProps) {
  const { label, courses, totalEcts, averageGrade, isOpen } = semester
  const plannedEcts = plannedCourses.reduce((sum, course) => sum + (course.ects ?? 0), 0)

  return (
    <div
      className={`flex w-80 shrink-0 flex-col rounded-[20px] border p-[17px] sm:w-96 ${
        isOpen
          ? 'border-[1.5px] border-[#7c5cff] bg-[#f6f2ff] shadow-[0_6px_20px_#7c5cff22] dark:bg-[#211a3a]'
          : 'border-[#ece7db] bg-[#faf8f3] shadow-[0_2px_10px_rgba(60,50,20,0.04)] dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`truncate text-[15px] font-bold tracking-[-0.01em] ${
            isOpen ? 'text-[#6a3ef0] dark:text-[#a893e0]' : 'text-[#221f19] dark:text-neutral-100'
          }`}
        >
          {formatSemesterLabelDisplay(label)}
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-[3px] text-[9.5px] font-bold uppercase tracking-wide ${
            isOpen
              ? 'bg-[#7c5cff] text-white'
              : 'bg-[#e2f4e9] text-[#187a45] dark:bg-green-500/15 dark:text-green-400'
          }`}
        >
          {isOpen ? 'Offen' : 'Fertig'}
        </span>
      </div>

      <div
        className={`mb-3 text-[11.5px] font-semibold ${
          isOpen ? 'text-[#6a3ef0] dark:text-[#a893e0]' : 'font-medium text-[#a39d90]'
        }`}
      >
        {isOpen
          ? `${plannedEcts} ECTS geplant · noch keine Note`
          : `${totalEcts} ECTS · Ø ${formatGrade(averageGrade)}`}
      </div>

      {isOpen ? (
        plannedCourses.length === 0 ? (
          <div className="flex min-h-[7rem] flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-dashed border-[#cabdf2] px-4 text-center text-[11.5px] leading-relaxed text-[#8a76c9]">
            Noch keine Kurse.
            <br />
            Unten einplanen →
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {plannedCourses.map((course) => {
              const selectableCats = categoryControl?.selectableOf(course) ?? []
              const category = categoryControl?.categoryOf(course) ?? null
              return (
                <li
                  key={course.id}
                  className="flex items-center gap-2.5 rounded-[13px] bg-white px-2.5 py-2.5 dark:bg-neutral-900/60"
                >
                  {categoryControl && selectableCats.length > 0 ? (
                    <CourseCategoryDropdown
                      value={category ?? selectableCats[0]}
                      selectable={selectableCats}
                      onChange={(cat) => categoryControl.change(course, cat)}
                    />
                  ) : (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#7c5cff]" />
                  )}
                  <span className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-snug text-[#221f19] dark:text-neutral-100">
                    {cleanCourseTitle(course.title, course.number)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemovePlanned?.(course.id)}
                    aria-label="Kurs aus dem Semester entfernen"
                    className="shrink-0 rounded-md px-1.5 text-[15px] font-bold leading-none text-[#a893e0] transition-colors hover:text-[#6a3ef0]"
                  >
                    ×
                  </button>
                </li>
              )
            })}
          </ul>
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {courses.map((course) => (
            <li
              key={course.id}
              className="flex items-center gap-2.5 rounded-[13px] border border-[#ece7db] bg-white px-2.5 py-2.5 dark:border-neutral-800 dark:bg-neutral-900/60"
            >
              <CategoryTag category={course.masterCat} />
              <span className="min-w-0 flex-1 break-words text-[11px] font-semibold leading-snug text-[#4a473f] dark:text-neutral-200">
                {course.title}
              </span>
              <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-[#a39d90]">
                {formatGrade(course.grade)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
