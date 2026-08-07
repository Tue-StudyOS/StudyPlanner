import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StarRating } from '../../../shared/components/StarRating'
import { useAuth } from '../../auth'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n/translations'
import { ROUTES } from '../../routes'
import { useCourseReviews } from '../hooks/useCourseReviews.ts'
import type { CourseReviewSummary } from '../types.ts'
import {
  formatAverageRating,
  getBreakdownPercentage,
  getSubRatingRows,
} from '../utils/reviewSummary.ts'
import { ReviewForm } from './ReviewForm'
import { ReviewList } from './ReviewList'

interface CourseReviewsSectionProps {
  courseId: string
}

const SUB_RATING_LABEL_KEYS: Record<'exam' | 'content' | 'tutorial', TranslationKey> = {
  exam: 'reviews.examLabel',
  content: 'reviews.contentLabel',
  tutorial: 'reviews.tutorialLabel',
}

// Returns null when the course has no reviews: the list below owns the single
// empty-state message, so showing one here too would duplicate it.
function SummaryHeadline({ summary }: { summary: CourseReviewSummary }) {
  const { t } = useTranslation()
  const average = formatAverageRating(summary.average)

  if (average === null || summary.count === 0) {
    return null
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-5">
      <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1">
        <span className="text-[30px] font-semibold leading-none text-fg">{average}</span>
        <div className="grid gap-1">
          <StarRating
            value={Math.round(summary.average ?? 0)}
            label={t('reviews.overallLabel')}
            size="sm"
          />
          <span className="text-[11.5px] text-fg-muted">
            {summary.count === 1
              ? t('reviews.countOne')
              : t('reviews.count', { count: String(summary.count) })}
          </span>
        </div>
      </div>

      <div className="grid min-w-0 gap-1">
        {[5, 4, 3, 2, 1].map((star) => {
          const starKey = String(star) as '1' | '2' | '3' | '4' | '5'
          const count = summary.breakdown[starKey]
          return (
            <div key={star} className="flex min-w-0 items-center gap-2">
              <span className="w-3 shrink-0 text-right text-[11px] text-fg-muted">{star}</span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border-light">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${getBreakdownPercentage(count, summary.count)}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-[11px] text-fg-muted">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function CourseReviewsSection({ courseId }: CourseReviewsSectionProps) {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuth()
  const { data, isLoading, loadError, isSaving, saveError, submitReview, removeReview } =
    useCourseReviews(courseId)
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false)

  if (isLoading && !data) {
    return <p className="text-[13px] text-fg-muted">{t('reviews.loading')}</p>
  }

  if (loadError && !data) {
    return (
      <div className="rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
        {loadError}
      </div>
    )
  }

  if (!data) {
    return null
  }

  const subRatingRows = getSubRatingRows(data.summary)

  return (
    <div className="grid min-w-0 gap-4">
      {/* The write action leads the section so it stays reachable without
          scrolling past the summary and the whole review list. */}
      {!isAuthenticated ? (
        <div className="rounded-[10px] border border-dashed border-border bg-surface px-3 py-2.5 text-[12.5px] text-fg-muted">
          {t('reviews.signInPrompt')}{' '}
          <Link to={ROUTES.account} className="font-medium text-primary hover:underline">
            {t('common.signInOrCreate')}
          </Link>
        </div>
      ) : isFormOpen ? (
        <ReviewForm
          options={data.options}
          existingReview={data.viewerReview}
          isSaving={isSaving}
          saveError={saveError}
          onSubmit={async (payload) => {
            const didSave = await submitReview(payload)
            if (didSave) {
              setIsFormOpen(false)
            }
            return didSave
          }}
          onDelete={async () => {
            const didDelete = await removeReview()
            if (didDelete) {
              setIsFormOpen(false)
            }
            return didDelete
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="justify-self-start rounded-md border border-border px-3.5 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          {data.viewerReview ? t('reviews.editReview') : t('reviews.writeReview')}
        </button>
      )}

      <SummaryHeadline summary={data.summary} />

      {subRatingRows.length > 0 ? (
        <div className="grid min-w-0 gap-1.5">
          {subRatingRows.map((row) => (
            <div
              key={row.key}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px]"
            >
              <span className="min-w-0 break-words text-fg-mid">
                {t(SUB_RATING_LABEL_KEYS[row.key])}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <StarRating
                  value={Math.round(row.average)}
                  label={t(SUB_RATING_LABEL_KEYS[row.key])}
                  size="sm"
                />
                <span className="text-fg-muted">{formatAverageRating(row.average)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <ReviewList reviews={data.reviews} />

      <p className="text-[11.5px] text-fg-muted">{t('reviews.anonymousNotice')}</p>
    </div>
  )
}
