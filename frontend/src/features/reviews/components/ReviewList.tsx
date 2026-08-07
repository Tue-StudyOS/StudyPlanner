import { StarRating } from '../../../shared/components/StarRating'
import { useTranslation } from '../../i18n'
import type { CourseReview } from '../types.ts'
import { sortReviewsForDisplay } from '../utils/reviewSummary.ts'

interface ReviewListProps {
  reviews: CourseReview[]
}

function ReviewMeta({ review }: { review: CourseReview }) {
  const { t } = useTranslation()
  const parts = [review.takenPeriodLabel, review.lecturerName].filter(
    (part): part is string => Boolean(part),
  )
  if (parts.length === 0 && !review.isMine) {
    return null
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-fg-muted">
      {review.isMine ? (
        <span className="shrink-0 rounded-full border border-primary px-1.5 py-0.25 text-[10.5px] font-medium text-primary">
          {t('reviews.yourReview')}
        </span>
      ) : null}
      {parts.map((part) => (
        <span key={part} className="min-w-0 break-words">
          {part}
        </span>
      ))}
    </div>
  )
}

export function ReviewList({ reviews }: ReviewListProps) {
  const { t } = useTranslation()

  if (reviews.length === 0) {
    return <p className="text-[13px] text-fg-muted">{t('reviews.empty')}</p>
  }

  return (
    <ul className="grid list-none gap-3 p-0">
      {sortReviewsForDisplay(reviews).map((review) => (
        <li
          key={review.id}
          className="min-w-0 rounded-[10px] border border-border-light bg-surface px-3 py-2.5"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <StarRating
              value={review.overallRating}
              label={t('reviews.overallLabel')}
              size="sm"
            />
          </div>
          <div className="mt-1">
            <ReviewMeta review={review} />
          </div>
          {review.comment ? (
            <p className="mt-2 min-w-0 whitespace-pre-line break-words text-[13px] leading-5 text-fg-mid">
              {review.comment}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
