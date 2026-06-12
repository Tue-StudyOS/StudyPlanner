import { forwardRef } from 'react'
import type { Course } from '../../features/courses'
import { formatTermTypeLabel, type OfferingStatus } from '../../features/courses/utils/catalogOffering.ts'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../features/courses/utils/courseTitle.ts'
import { CatBadge } from './CatBadge'
import { CompletedBadge } from './CompletedBadge'
import { FavStar } from './FavStar'
import { UserIcon } from './icons'

interface CourseCardProps {
  course: Course
  isFavorite: boolean
  isActive?: boolean
  isCompleted?: boolean
  favoriteDisabled?: boolean
  offeringStatus?: OfferingStatus
  onSelect: () => void
  onToggleFavorite: () => void
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
}

function plainLecturerName(lecturer: string): string {
  return lecturer.replace(/Prof\. Dr\. |Prof\. |Dr\. /g, '')
}

function OfferingStatusTag({ status }: { status: OfferingStatus }) {
  if (status === 'likely') {
    return (
      <span className="inline-block whitespace-nowrap rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10.5px] font-medium text-primary">
        Likely offered
      </span>
    )
  }
  if (status === 'unknown') {
    return (
      <span className="inline-block whitespace-nowrap rounded-full border border-border bg-surface-hover px-2 py-0.5 text-[10.5px] font-medium text-fg-muted">
        No current data
      </span>
    )
  }
  return null
}

export const CourseCard = forwardRef<HTMLDivElement, CourseCardProps>(function CourseCard(
  {
    course,
    isFavorite,
    isActive = false,
    isCompleted = false,
    favoriteDisabled = false,
    offeringStatus = 'confirmed',
    onSelect,
    onToggleFavorite,
  },
  ref,
) {
  const borderClasses = isActive
    ? 'border-primary ring-1 ring-primary/40'
    : 'border-border hover:border-primary/30'
  const isDimmed = offeringStatus === 'unknown'
  const termLabel = formatTermTypeLabel(course.termType)
  const title = cleanCourseTitle(course.title, course.number)

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Kursdetails öffnen: ${title}`}
      aria-pressed={isActive}
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-[10px] border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${borderClasses} ${
        isDimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TypePill label={formatCourseTypeLabel(course.types)} />
          <div className="flex flex-1 flex-wrap gap-0.75">
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
          </div>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
        </div>
      </div>

      <h3 className="text-[15.5px] font-semibold leading-tight text-fg transition-colors group-hover:text-primary">
        {title}
      </h3>

      <div className="flex min-w-0 items-center gap-2 border-t border-border-light pt-2 text-[12.5px] text-fg-mid">
        <span className="text-fg-muted">
          <UserIcon />
        </span>
        <span className="min-w-0 flex-1 truncate">{plainLecturerName(course.lecturer || 'TBA')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {termLabel ? (
          <span className="text-[11px] font-medium text-fg-muted">{termLabel} term</span>
        ) : null}
        <OfferingStatusTag status={offeringStatus} />
        <span className="flex-1" />
        {isCompleted ? <CompletedBadge /> : null}
      </div>
    </div>
  )
})
