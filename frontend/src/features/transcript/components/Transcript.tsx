import { StatItem } from '../../../shared/components/StatItem'
import type { CompletedCourse, MasterCat } from '../../courses'
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
}

function ImportedCourseRow({ course, isLast, onRemove, onCategoryChange }: ImportedCourseRowProps) {
  return (
    <div className={`flex items-center gap-3 py-3 ${isLast ? '' : 'border-b border-border-light'}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-fg">{course.title}</div>
        <div className="mb-2.5 text-[11px] text-fg-muted">
          {course.semester} · {course.ects} ECTS
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((cat) => (
            <CategoryToggle
              key={cat}
              cat={cat}
              active={cat === course.masterCat}
              onClick={() => onCategoryChange(cat)}
            />
          ))}
        </div>
      </div>
      <span className="shrink-0 text-[16px] font-bold text-fg">{course.grade}</span>
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

export function Transcript() {
  const { completedCourses, removeCourse, setCategory } = useTranscript()
  const { totalEcts, requiredEcts, progress, averageGrade } = useStudyStats()

  const stats = [
    { label: 'Progress', value: `${progress} %` },
    { label: 'ECTS Earned', value: `${totalEcts} / ${requiredEcts}` },
    { label: 'Ø Grade', value: averageGrade !== null ? averageGrade.toFixed(2) : '–' },
  ]

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

      <div className="grid grid-cols-5 items-start gap-3.5">
        <UploadDropZone />

        <div className="col-span-3 flex flex-col gap-3.5">
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

            {completedCourses.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-fg-muted">
                No courses imported yet.
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
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
