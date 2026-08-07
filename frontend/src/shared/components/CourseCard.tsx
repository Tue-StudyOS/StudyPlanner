import { Link } from 'react-router-dom'
import { useAuth } from '../../features/auth'
import type { Course, CourseTermType } from '../../features/courses'
import type { OfferingStatus } from '../../features/courses/utils/catalogOffering.ts'
import { getDetailSeasonTermType } from '../../features/courses/utils/catalogOffering.ts'
import { buildCourseAreaTags, getCompletedCourseCardVisibility } from '../../features/courses/utils/courseCardDisplay.ts'
import { buildCourseSeasonIconTitle } from '../../features/courses/utils/courseOfferingLabel.ts'
import { cleanCourseTitle } from '../../features/courses/utils/courseTitle.ts'
import { formatCourseLecturerName } from '../../features/courses/utils/lecturerName.ts'
import { useTranslation } from '../../features/i18n'
import { formatAverageRating, shouldShowRatingChip } from '../../features/reviews'
import { AreaBadge } from './AreaBadge'
import { SeasonGlyphWatermark } from './SeasonGlyphWatermark.tsx'
import { SeasonSymbol } from './SeasonSymbol.tsx'
import { FavStar } from './FavStar'
import type { RegulationRuleGroup } from '../../shared/utils/regulation.ts'

interface CourseCardProps {
  course: Course
  // When set, the card renders as a real link so Ctrl/Cmd-click and
  // middle-click open the course detail URL in a new tab. Without it the card
  // falls back to a plain button row (inert tour sample cards).
  detailTo?: string
  isFavorite: boolean
  isActive?: boolean
  isCompleted?: boolean
  favoriteDisabled?: boolean
  favoriteLoading?: boolean
  showFavorite?: boolean
  offeringStatus?: OfferingStatus
  // Overrides the raw course.termType so callers can align season tags with
  // the same catalog freshness window they use for filtering.
  seasonTermType?: CourseTermType
  regulationRuleGroups?: RegulationRuleGroup[]
  isAreaTagActive?: (areaCode: string) => boolean
  onAreaTagClick?: (areaCode: string) => void
  lecturerLabel?: string
  onSelect?: () => void
  onToggleFavorite: () => void
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

export function CourseCard({
  course,
  detailTo,
  isFavorite,
  isActive = false,
  isCompleted = false,
  favoriteDisabled = false,
  favoriteLoading = false,
  showFavorite = true,
  offeringStatus = 'confirmed',
  seasonTermType,
  regulationRuleGroups = [],
  isAreaTagActive,
  onAreaTagClick,
  lecturerLabel,
  onSelect,
  onToggleFavorite,
}: CourseCardProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const areaTags = buildCourseAreaTags(course, user?.profile.studyProgramCode ?? null, regulationRuleGroups)
  const resolvedLecturerLabel = lecturerLabel ?? formatCourseLecturerName(course)
  // Likely-offered courses get a dashed border: plannable, but not confirmed.
  const borderClasses = isActive
    ? 'border-primary ring-1 ring-primary/40'
    : offeringStatus === 'likely'
      ? 'border-2 border-dashed border-fg-muted hover:border-fg-muted'
      : 'border-border hover:border-primary/30'
  const isDimmed = offeringStatus === 'unknown' && !isCompleted
  const title = cleanCourseTitle(course.title, course.number)
  const ectsLabel = course.ects === null
    ? null
    : Number.isInteger(course.ects) ? String(course.ects) : course.ects.toFixed(1)
  const visibility = getCompletedCourseCardVisibility(isCompleted)
  const footerTags = visibility.showSecondaryDetails
    ? [
        ...areaTags.map((tag) => ({ kind: 'area' as const, tag })),
        ...(offeringStatus === 'unknown'
          ? [{ kind: 'status' as const }]
          : []),
      ]
    : []

  const cardClassName = `group relative flex h-full min-h-[7rem] cursor-pointer flex-col gap-2 overflow-hidden rounded-[10px] border bg-surface px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${borderClasses} ${
    isDimmed ? 'opacity-60' : ''
  }`
  const accessibleLabel = `Open course details: ${title}`

  // Most of the ~1000 catalog courses have no reviews yet, so the chip stays
  // absent rather than rendering an empty placeholder on every card.
  const rating = shouldShowRatingChip(course.rating) ? course.rating : undefined

  const resolvedSeasonTermType = seasonTermType ?? course.termType
  const glyphTermType = (() => {
    if (resolvedSeasonTermType && resolvedSeasonTermType !== 'unknown') {
      return resolvedSeasonTermType
    }
    const detailTermType = getDetailSeasonTermType(course)
    return detailTermType !== 'unknown' ? detailTermType : resolvedSeasonTermType
  })()
  const hasSeasonIcon = Boolean(glyphTermType && glyphTermType !== 'unknown')
  const seasonIconTitle = buildCourseSeasonIconTitle(glyphTermType, {
    summer: t('catalog.seasonIcon.summer'),
    winter: t('catalog.seasonIcon.winter'),
    both: t('catalog.seasonIcon.both'),
  })

  const cardContent = (
    <>
      <SeasonGlyphWatermark
        overlay={
          showFavorite ? (
            // The overlay slot is pointer-events-none so card clicks pass
            // through; only the bookmark itself opts back in.
            <div
              className="pointer-events-auto"
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <FavStar
                active={isFavorite}
                disabled={favoriteDisabled}
                isLoading={favoriteLoading}
                onToggle={onToggleFavorite}
              />
            </div>
          ) : undefined
        }
      />
      <div className="relative flex min-w-0 items-start gap-2 pr-8">
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 break-words text-[15.5px] font-semibold leading-tight text-fg transition-colors group-hover:text-primary overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] sm:overflow-visible sm:[display:block]">
            {title}
          </h3>
          {visibility.showCompletedLabel ? (
            <div className="mt-1 min-w-0">
              <div className="text-[13px] font-medium text-accent">{t('catalog.completed')}</div>
              {resolvedLecturerLabel ? (
                <span className="mt-0.5 block min-w-0 truncate text-[12px] text-fg-muted">
                  {resolvedLecturerLabel}
                </span>
              ) : null}
            </div>
          ) : resolvedLecturerLabel ? (
            <span className="mt-1 block min-w-0 truncate text-[12px] text-fg-muted">
              {resolvedLecturerLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-auto flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-1.5 sm:gap-y-1.5">
        {footerTags.length > 0 ? (
          <span className="flex flex-wrap items-center gap-0.75">
            {footerTags.map((entry) =>
              entry.kind === 'area' ? (
                <AreaBadge
                  key={entry.tag.key}
                  label={entry.tag.label}
                  masterCat={entry.tag.masterCat}
                  active={isAreaTagActive?.(entry.tag.key) ?? false}
                  onClick={onAreaTagClick ? () => onAreaTagClick(entry.tag.key) : undefined}
                />
              ) : (
                <OfferingStatusTag key="offering-status" status={offeringStatus} />
              ),
            )}
          </span>
        ) : null}
        {hasSeasonIcon || ectsLabel || rating ? (
          <span className="flex shrink-0 items-center justify-end gap-1 text-[13px] font-bold text-fg sm:ml-auto sm:justify-start">
            {rating ? (
              <span
                className="mr-0.5 inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-[12.5px] font-semibold text-fg"
                aria-label={t('reviews.ratingChipLabel', {
                  average: formatAverageRating(rating.average) ?? '',
                  count: rating.count,
                })}
              >
                <span aria-hidden="true" className="text-primary">
                  ★
                </span>
                {formatAverageRating(rating.average)}
                <span className="text-[11px] font-normal text-fg-muted">({rating.count})</span>
              </span>
            ) : null}
            {hasSeasonIcon ? (
              <span
                className="inline-flex shrink-0"
                {...(seasonIconTitle ? { title: seasonIconTitle, 'aria-label': seasonIconTitle } : {})}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <SeasonSymbol
                  termType={glyphTermType}
                  tone="seasonal"
                  className="h-4 w-4 shrink-0"
                />
              </span>
            ) : null}
            {ectsLabel ? (
              <>
                {ectsLabel} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    </>
  )

  if (detailTo) {
    return (
      <Link
        to={detailTo}
        aria-label={accessibleLabel}
        aria-current={isActive ? 'true' : undefined}
        // Links ignore the Space key by default; mirror the previous button
        // behavior so keyboard users keep both activation keys.
        onKeyDown={(event) => {
          if (event.key === ' ') {
            event.preventDefault()
            event.currentTarget.click()
          }
        }}
        className={cardClassName}
      >
        {cardContent}
      </Link>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.()
        }
      }}
      aria-label={accessibleLabel}
      aria-pressed={isActive}
      className={cardClassName}
    >
      {cardContent}
    </div>
  )
}
