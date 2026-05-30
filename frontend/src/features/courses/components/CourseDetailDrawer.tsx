import { useEffect, useRef } from 'react'
import { CatBadge } from '../../../shared/components/CatBadge'
import { CompletedBadge } from '../../../shared/components/CompletedBadge'
import { FavStar } from '../../../shared/components/FavStar'
import type { CompletedCourse, Course } from '../types'

interface CourseDetailDrawerProps {
  course: Course
  completedCourse?: CompletedCourse
  isFavorite: boolean
  favoriteDisabled?: boolean
  onToggleFavorite: () => void
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {title}
      </div>
      <div className="h-px w-full bg-border-light" />
      <div className="mt-3">{children}</div>
    </section>
  )
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function formatEcts(ects: number | null): string {
  if (ects === null) return '–'
  return Number.isInteger(ects) ? String(ects) : ects.toFixed(1)
}

export function CourseDetailDrawer({
  course,
  completedCourse,
  isFavorite,
  favoriteDisabled = false,
  onToggleFavorite,
  onClose,
}: CourseDetailDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [course.id])

  const typeLabel = course.types.join(' + ') || 'Course'

  const metaRows: Array<[string, string]> = [
    ['Course number', course.number],
    ['Lecturer', course.lecturer || 'TBA'],
    ['Room', course.room || '–'],
    ['ECTS', course.ects === null ? '–' : formatEcts(course.ects)],
    ['SWS', course.sws === null ? '–' : `${course.sws} SWS`],
    ['Language', course.language || '–'],
    ['Frequency', course.frequency || '–'],
  ]

  return (
    <aside className="flex min-w-0 w-full flex-1 flex-col border-l border-border bg-bg shadow-[-12px_0_32px_rgba(0,0,0,0.12)] md:h-full md:w-[480px] md:max-w-[520px] md:flex-shrink-0 md:flex-none">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5 py-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Course Details
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close course details"
          className="flex items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <CloseIcon />
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <div className="relative mb-6 min-w-0 rounded-[14px] border border-border bg-surface px-4 py-4 sm:px-5 sm:py-5">
          <div className="absolute right-3.5 top-3.5">
            <FavStar
              active={isFavorite}
              disabled={favoriteDisabled}
              onToggle={onToggleFavorite}
            />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-1.5 pr-9">
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
            <TypePill label={typeLabel} />
          </div>

          <h1 className="break-words font-serif text-[20px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[22px]">
            {course.title}
          </h1>

          {completedCourse ? (
            <div className="mt-4">
              <CompletedBadge
                size="md"
                grade={completedCourse.grade}
                semester={completedCourse.semester}
              />
            </div>
          ) : null}
        </div>

        <Section title="Description">
          <p className="whitespace-pre-wrap text-[13.5px] leading-7 text-fg-mid">
            {course.description || 'No description available.'}
          </p>
        </Section>

        <Section title="Prerequisites">
          {course.prerequisites.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No prerequisites.</div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {course.prerequisites.map((prerequisite) => (
                <li
                  key={prerequisite}
                  className="flex items-baseline gap-2.5 text-[13.5px] text-fg-mid"
                >
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{prerequisite}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Assessments">
          {course.exams.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No assessments published.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {course.exams.map((exam, index) => (
                <div
                  key={`${exam.type}-${exam.date}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-border border-l-[3px] border-l-primary bg-surface px-4 py-3"
                >
                  <span className="text-[13.5px] font-medium text-fg">{exam.type}</span>
                  <div className="flex items-center gap-3 text-[12.5px] text-fg-muted">
                    <span>{exam.date}</span>
                    {exam.duration && exam.duration !== '–' ? <span>{exam.duration}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Schedule">
          {course.schedule.length === 0 ? (
            <div className="text-[13px] text-fg-muted">No schedule published.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {course.schedule.map((slot, index) => (
                <div
                  key={`${slot.day}-${slot.time}-${index}`}
                  className="rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg"
                >
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="font-semibold">
                      {slot.day}, {slot.time}
                    </span>
                    {slot.type ? <TypePill label={slot.type} /> : null}
                  </div>
                  <div className="text-[12.5px] text-fg-muted">{slot.room}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <div className="min-w-0 overflow-hidden rounded-[12px] border border-border bg-surface">
          <div className="border-b border-border px-4.5 py-3 text-[13px] font-semibold text-fg">
            Course Details
          </div>
          {metaRows.map(([key, value], index) => (
            <div
              key={key}
              className={`grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-3 px-4.5 py-3 sm:grid-cols-[100px_minmax(0,1fr)] ${
                index < metaRows.length - 1 ? 'border-b border-border-light' : ''
              }`}
            >
              <span className="text-[12px] font-medium text-fg-muted">{key}</span>
              <span className="break-words text-[13px] text-fg">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
