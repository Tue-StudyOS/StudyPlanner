import { forwardRef } from 'react'
import type { Course } from '../../features/courses'
import type { OfferingStatus } from '../../features/courses/utils/catalogOffering.ts'
import { buildCourseCardTagOrder, getCompletedCourseCardVisibility } from '../../features/courses/utils/courseCardDisplay.ts'
import { cleanCourseTitle, formatCourseTypeLabel } from '../../features/courses/utils/courseTitle.ts'
import { useTranslation } from '../../features/i18n'
import { CatBadge } from './CatBadge'
import { FavStar } from './FavStar'
import { SeasonTags } from './SeasonTag'

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

// The dashed card border already marks likely-offered courses; only the
// faded "no current data" state keeps an explicit tag.
function OfferingStatusTag({ status }: { status: OfferingStatus }) {
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
  const { t } = useTranslation()
  // Likely-offered courses get a dashed border: plannable, but not confirmed.
  const borderClasses = isActive
    ? 'border-primary ring-1 ring-primary/40'
    : `${offeringStatus === 'likely' ? 'border-dashed' : ''} border-border hover:border-primary/30`
  const isDimmed = offeringStatus === 'unknown' && !isCompleted
  const title = cleanCourseTitle(course.title, course.number)
  const ectsLabel = course.ects === null
    ? null
    : Number.isInteger(course.ects) ? String(course.ects) : course.ects.toFixed(1)
  const visibility = getCompletedCourseCardVisibility(isCompleted)
  const tagOrder = buildCourseCardTagOrder(course)
  const secondaryVisibilityClass = visibility.showSecondaryDetails ? '' : 'invisible pointer-events-none select-none'

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
      aria-label={`Open course details: ${title}`}
      aria-pressed={isActive}
      className={`group relative flex h-full cursor-pointer flex-col gap-3 rounded-[10px] border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${borderClasses} ${
        isDimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 break-words text-[15.5px] font-semibold leading-tight text-fg transition-colors group-hover:text-primary">
            {title}
          </h3>
          {visibility.showCompletedLabel ? (
            <div className="mt-1 text-[13px] font-medium text-accent">
              {t('catalog.completed')}
            </div>
          ) : (
            <span className="mt-1 block min-w-0 truncate text-[12px] text-fg-muted">
              {plainLecturerName(course.lecturer || 'TBA')}
            </span>
          )}
        </div>
        <div className={secondaryVisibilityClass} onClick={(event) => event.stopPropagation()}>
          <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <SeasonTags termType={course.termType} />
        <span className={secondaryVisibilityClass}>
          <TypePill label={formatCourseTypeLabel(tagOrder.typeLabels)} />
        </span>
        <span className={`flex flex-wrap gap-0.75 ${secondaryVisibilityClass}`}>
          {tagOrder.categoryLabels.map((cat) => (
            <CatBadge key={cat} cat={cat} />
          ))}
          <OfferingStatusTag status={offeringStatus} />
        </span>
        <span className="flex-1" />
        {ectsLabel ? (
          <span className="shrink-0 text-[13px] font-bold text-fg">
            {ectsLabel} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
          </span>
        ) : null}
      </div>
    </div>
  )
})
