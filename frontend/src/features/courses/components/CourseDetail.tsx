import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CatBadge } from '../../../shared/components/CatBadge'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { ROUTES } from '../../routes'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-border bg-surface px-6 py-5.5">
      <h2 className="mb-3 text-[14px] font-semibold text-fg">{title}</h2>
      {children}
    </section>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </div>
      <div className="text-[13.5px] text-fg">{value}</div>
    </div>
  )
}

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { isAuthenticated } = useAuth()
  const { course, isLoading, error } = useCatalogCourseDetail(courseId)
  const {
    isFavorite,
    isLoadingFavorites,
    isSavingFavorites,
    favoritesError,
    toggleFavorite,
  } = useFavorites()

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8">
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading course details...
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="p-4 sm:p-8">
        <div className="mb-4">
          <Link to={ROUTES.catalog} className="text-[13px] font-medium text-primary hover:underline">
            ← Back to catalog
          </Link>
        </div>
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Failed to load the course detail. {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      {!isAuthenticated ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          This is public catalog data from the database. Sign in only if you want to save favorites or personal progress.
        </div>
      ) : null}

      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to={ROUTES.catalog} className="mb-4 inline-block text-[13px] font-medium text-primary hover:underline">
            ← Back to catalog
          </Link>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {course.types.map((type) => (
              <span
                key={type}
                className="rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text"
              >
                {type}
              </span>
            ))}
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
          </div>
          <h1 className="mb-1 font-serif text-[28px] font-semibold tracking-[-0.02em] text-fg">
            {course.title}
          </h1>
          <p className="text-[13.5px] text-fg-muted">
            {course.number} · {course.organisation || 'StudyOS catalog'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => toggleFavorite(course.id)}
          disabled={isLoadingFavorites || isSavingFavorites}
          className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFavorite(course.id) ? 'Remove favorite' : 'Add favorite'}
        </button>
      </div>

      <div className="grid gap-4.5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4.5">
          <DetailSection title="About this course">
            <p className="whitespace-pre-wrap text-[13.5px] leading-6 text-fg-mid">
              {course.description || 'No description available yet.'}
            </p>
          </DetailSection>

          <DetailSection title="Schedule">
            {course.schedule.length === 0 ? (
              <div className="text-[13px] text-fg-muted">No schedule data available.</div>
            ) : (
              <div className="grid gap-2.5">
                {course.schedule.map((slot, index) => (
                  <div
                    key={`${slot.day}-${slot.time}-${index}`}
                    className="rounded-lg border border-border-light px-4 py-3"
                  >
                    <div className="text-[13px] font-semibold text-fg">{slot.type}</div>
                    <div className="text-[12.5px] text-fg-mid">
                      {slot.day} · {slot.time}
                    </div>
                    <div className="text-[12.5px] text-fg-muted">{slot.room}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="Prerequisites">
            {course.prerequisites.length === 0 ? (
              <div className="text-[13px] text-fg-muted">No prerequisites listed.</div>
            ) : (
              <ul className="grid gap-2 pl-5 text-[13.5px] text-fg-mid">
                {course.prerequisites.map((prerequisite) => (
                  <li key={prerequisite} className="list-disc">
                    {prerequisite}
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>

          <DetailSection title="Regulation mapping">
            {course.studyAreaOptions?.length ? (
              <div className="grid gap-2.5">
                {course.studyAreaOptions.map((option) => (
                  <div
                    key={`${option.programCode}-${option.studyAreaCode}-${option.optionStatus}-${option.moduleCode}`}
                    className="rounded-lg border border-border-light px-4 py-3"
                  >
                    <div className="text-[13px] font-semibold text-fg">
                      {option.programName || option.programCode || 'Unassigned program'}
                    </div>
                    <div className="text-[12.5px] text-fg-mid">
                      {option.studyAreaName || option.studyAreaCode || 'Unknown study area'}
                    </div>
                    <div className="text-[12px] text-fg-muted">
                      Status: {option.optionStatus}
                      {option.ectsCounted !== null ? ` · Counts as ${option.ectsCounted} ECTS` : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[13px] text-fg-muted">
                No regulation mapping has been seeded for this course yet.
              </div>
            )}
          </DetailSection>
        </div>

        <div className="grid gap-4.5">
          <DetailSection title="Catalog facts">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <MetaItem label="Lecturers" value={course.lecturer || 'TBA'} />
              <MetaItem label="ECTS" value={course.ects === null ? 'Unknown' : String(course.ects)} />
              <MetaItem label="Semester hours" value={course.sws === null ? 'Unknown' : String(course.sws)} />
              <MetaItem label="Language" value={course.language || 'Unknown'} />
              <MetaItem label="Frequency" value={course.frequency || 'Unknown'} />
              <MetaItem
                label="Registration"
                value={course.registrationPeriod || 'No registration period published'}
              />
            </div>
          </DetailSection>

          <DetailSection title="Assessments">
            {course.exams.length === 0 ? (
              <div className="text-[13px] text-fg-muted">No assessments published.</div>
            ) : (
              <div className="grid gap-2.5">
                {course.exams.map((exam, index) => (
                  <div
                    key={`${exam.type}-${exam.date}-${index}`}
                    className="rounded-lg border border-border-light px-4 py-3"
                  >
                    <div className="text-[13px] font-semibold text-fg">{exam.type}</div>
                    <div className="text-[12.5px] text-fg-mid">{exam.date}</div>
                    <div className="text-[12px] text-fg-muted">{exam.duration}</div>
                  </div>
                ))}
              </div>
            )}
          </DetailSection>

          <DetailSection title="External links">
            <div className="grid gap-2 text-[13px] text-primary">
              {course.detailUrl ? (
                <a href={course.detailUrl} target="_blank" rel="noreferrer" className="hover:underline">
                  Open Alma detail page
                </a>
              ) : null}
              {course.detailPageUrl ? (
                <a
                  href={course.detailPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  Open public detail page
                </a>
              ) : null}
              {!course.detailUrl && !course.detailPageUrl ? (
                <div className="text-fg-muted">No external links published.</div>
              ) : null}
            </div>
          </DetailSection>
        </div>
      </div>
    </div>
  )
}
