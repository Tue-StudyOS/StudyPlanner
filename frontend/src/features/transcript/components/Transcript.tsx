import { useMemo, useState } from 'react'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { StatItem } from '../../../shared/components/StatItem'
import { useAuth } from '../../auth'
import { useCatalogCourses } from '../../courses'
import type { CompletedCourse, Course, MasterCat } from '../../courses'
import { useStudyStats } from '../hooks/useStudyStats'
import { useTranscript } from '../hooks/useTranscript'
import { CategoryToggle } from './CategoryToggle'
import { CloseIcon, UploadIcon } from './icons'

const ALL_CATEGORIES: MasterCat[] = ['TECH', 'THEO', 'PRAK', 'INFO', 'FOKUS', 'BASIS']

function UploadDropZone() {
  return (
    <div className="col-span-2 flex flex-col items-center justify-center gap-3 self-start rounded-[10px] border-2 border-dashed border-border bg-surface px-8 py-20 text-center">
      <div className="flex items-center justify-center rounded-md bg-pill-bg p-3 text-fg-mid">
        <UploadIcon />
      </div>
      <div className="text-[15px] font-semibold text-fg">Drop PDF here</div>
      <div className="text-[12px] text-fg-muted">or click · PDF, CSV, XLSX</div>
    </div>
  )
}

interface ImportedCourseRowProps {
  course: CompletedCourse
  isLast: boolean
  onRemove: () => void
  onCategoryChange: (cat: MasterCat) => void
  onSemesterChange: (semester: string) => void
  onGradeChange: (grade: string) => void
}

function ImportedCourseRow({
  course,
  isLast,
  onRemove,
  onCategoryChange,
  onSemesterChange,
  onGradeChange,
}: ImportedCourseRowProps) {
  return (
    <div className={`flex items-start gap-3 py-3 ${isLast ? '' : 'border-b border-border-light'}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-fg">{course.title}</div>
        <div className="mb-2.5 text-[11px] text-fg-muted">
          {(course.courseNumber || course.externalCourseCode || 'Manual entry') + ` · ${course.ects} ECTS`}
        </div>
        <div className="mb-2.5 flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryToggle
              key={cat}
              cat={cat}
              active={cat === course.masterCat}
              onClick={() => onCategoryChange(cat)}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Semester
            </span>
            <input
              type="text"
              value={course.semester}
              onChange={(event) => onSemesterChange(event.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Grade
            </span>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={course.grade ?? ''}
              onChange={(event) => onGradeChange(event.target.value)}
              placeholder="optional"
              className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
            />
          </label>
        </div>
      </div>
      <span className="shrink-0 pt-1 text-[16px] font-bold text-fg">{course.grade ?? '–'}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${course.title}`}
        className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

function toCompletedCourse(course: Course, currentSemesterLabel: string | null | undefined): CompletedCourse {
  return {
    id: `draft-${course.id}`,
    courseId: course.id,
    courseNumber: course.number,
    externalCourseCode: course.number,
    title: course.title,
    ects: course.ects ?? 0,
    masterCat: course.masterCats[0] ?? 'INFO',
    grade: null,
    semester: currentSemesterLabel || 'Semester not set',
    source: 'manual',
  }
}

function AuthenticatedTranscript() {
  const { user } = useAuth()
  const [search, setSearch] = useState<string>('')
  const {
    completedCourses,
    isLoadingCompletedCourses,
    isSavingCompletedCourses,
    completedCoursesError,
    addCompletedCourse,
    removeCourse,
    setCategory,
    updateCourse,
  } = useTranscript()
  const { totalEcts, requiredEcts, progress, averageGrade } = useStudyStats()
  const { courses } = useCatalogCourses(search)

  const stats = [
    { label: 'Progress', value: `${progress} %` },
    { label: 'ECTS Earned', value: `${totalEcts} / ${requiredEcts}` },
    { label: 'Ø Grade', value: averageGrade !== null ? averageGrade.toFixed(2) : '–' },
  ]

  const addableCourses = useMemo(
    () =>
      courses
        .filter((course) => !completedCourses.some((completedCourse) => completedCourse.courseId === course.id))
        .slice(0, 6),
    [completedCourses, courses],
  )

  return (
    <div className="grid grid-cols-5 items-start gap-3.5">
      <div className="col-span-2 grid gap-3.5">
        <UploadDropZone />

        <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
          <div className="mb-3 text-[14px] font-semibold text-fg">Add completed courses manually</div>
          <p className="mb-3 text-[12.5px] text-fg-muted">
            Until transcript import is finished, you can already add completed catalog courses to your account.
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by course title or number"
            className="mb-3 w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
          />
          <div className="grid gap-2">
            {addableCourses.length === 0 ? (
              <div className="text-[12.5px] text-fg-muted">No matching catalog courses available.</div>
            ) : (
              addableCourses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  onClick={() =>
                    addCompletedCourse(toCompletedCourse(course, user?.profile.currentSemesterLabel))
                  }
                  className="rounded-lg border border-border-light px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <div className="text-[13px] font-semibold text-fg">{course.title}</div>
                  <div className="text-[12px] text-fg-muted">
                    {course.number} · {course.ects ?? '–'} ECTS
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="col-span-3 flex flex-col gap-3.5">
        {completedCoursesError ? (
          <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
            {completedCoursesError}
          </div>
        ) : null}

        {isSavingCompletedCourses ? (
          <div className="rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
            Saving your completed-course history...
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3.5">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-[10px] border border-border bg-surface px-6 py-4.5"
            >
              <StatItem label={stat.label} value={stat.value} />
            </div>
          ))}
        </div>

        <div className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
          <div className="mb-4 text-[14px] font-semibold text-fg">Imported Courses</div>

          {isLoadingCompletedCourses ? (
            <div className="py-6 text-center text-[13px] text-fg-muted">
              Loading your completed courses...
            </div>
          ) : completedCourses.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-fg-muted">
              No completed courses stored yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {completedCourses.map((course, i) => (
                <ImportedCourseRow
                  key={course.id}
                  course={course}
                  isLast={i === completedCourses.length - 1}
                  onRemove={() => removeCourse(course.id)}
                  onCategoryChange={(cat) => setCategory(course.id, cat)}
                  onSemesterChange={(semester) => updateCourse(course.id, { semester })}
                  onGradeChange={(grade) =>
                    updateCourse(course.id, {
                      grade: grade.trim() === '' ? null : Number(grade),
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function Transcript() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="mb-0.75 font-serif text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Upload Transcript
        </h1>
        <p className="text-[13.5px] text-fg-muted">
          Upload your Transcript of Records — StudyOS automatically detects your courses and grades.
        </p>
      </div>

      {isAuthenticated ? (
        <AuthenticatedTranscript />
      ) : (
        <PersonalFeatureNotice
          title="Transcript and progress need your account"
          description="Your transcript, completed courses, and grade data are private. Sign in to upload or manage them while the public catalog remains accessible without login."
        />
      )}
    </div>
  )
}
