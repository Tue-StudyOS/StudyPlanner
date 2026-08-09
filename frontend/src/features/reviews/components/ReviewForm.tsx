import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { StarRating } from '../../../shared/components/StarRating'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n/translations'
import { ROUTES } from '../../routes.ts'
import type { CourseReview, CourseReviewDraft, CourseReviewOptions } from '../types.ts'
import {
  MAX_COMMENT_LENGTH,
  buildReviewPayload,
  toReviewDraft,
  validateReviewDraft,
  type CourseReviewPayload,
  type ReviewDraftError,
} from '../utils/reviewValidation.ts'

interface ReviewFormProps {
  options: CourseReviewOptions
  existingReview: CourseReview | null
  isSaving: boolean
  saveError: string | null
  onSubmit: (payload: CourseReviewPayload) => Promise<boolean>
  onDelete: () => Promise<boolean>
  onCancel: () => void
}

const SUB_RATING_FIELDS: {
  key: 'examRating' | 'contentRating' | 'tutorialRating'
  labelKey: TranslationKey
}[] = [
  { key: 'examRating', labelKey: 'reviews.examLabel' },
  { key: 'contentRating', labelKey: 'reviews.contentLabel' },
  { key: 'tutorialRating', labelKey: 'reviews.tutorialLabel' },
]

const DRAFT_ERROR_KEYS: Record<ReviewDraftError, TranslationKey> = {
  missingOverallRating: 'reviews.errorMissingOverall',
  commentTooShort: 'reviews.errorCommentTooShort',
  commentTooLong: 'reviews.errorCommentTooLong',
}

const SELECT_CLASSES =
  'w-full min-w-0 max-w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

export function ReviewForm({
  options,
  existingReview,
  isSaving,
  saveError,
  onSubmit,
  onDelete,
  onCancel,
}: ReviewFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<CourseReviewDraft>(() =>
    toReviewDraft(existingReview, options.lecturers),
  )
  const [draftError, setDraftError] = useState<ReviewDraftError | null>(null)

  function updateDraft(patch: Partial<CourseReviewDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
    setDraftError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const validationError = validateReviewDraft(draft)
    if (validationError) {
      setDraftError(validationError)
      return
    }
    await onSubmit(buildReviewPayload(draft))
  }

  const errorMessage = draftError ? t(DRAFT_ERROR_KEYS[draftError]) : saveError

  return (
    <form onSubmit={handleSubmit} className="grid min-w-0 gap-4">
      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-fg">{t('reviews.overallLabel')} *</span>
        <StarRating
          value={draft.overallRating}
          label={t('reviews.overallLabel')}
          onChange={(rating) => updateDraft({ overallRating: rating })}
        />
      </div>

      <div className="grid gap-2.5">
        <span className="text-[12.5px] font-medium text-fg">{t('reviews.optionalRatings')}</span>
        {SUB_RATING_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <span className="min-w-0 break-words text-[12.5px] text-fg-mid">
              {t(field.labelKey)}
            </span>
            <StarRating
              value={draft[field.key]}
              label={t(field.labelKey)}
              size="sm"
              clearable
              onChange={(rating) => updateDraft({ [field.key]: rating } as Partial<CourseReviewDraft>)}
            />
          </div>
        ))}
      </div>

      {options.periodLabels.length > 0 ? (
        <label className="grid min-w-0 gap-1.5">
          <span className="text-[12.5px] font-medium text-fg">{t('reviews.semesterLabel')}</span>
          <select
            value={draft.takenPeriodLabel}
            onChange={(event) => updateDraft({ takenPeriodLabel: event.target.value })}
            className={SELECT_CLASSES}
          >
            <option value="">{t('reviews.notSpecified')}</option>
            {options.periodLabels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {options.lecturers.length > 0 ? (
        <div className="grid min-w-0 gap-1.5">
          <label className="grid min-w-0 gap-1.5">
            <span className="text-[12.5px] font-medium text-fg">{t('reviews.lecturerLabel')}</span>
            <select
              value={draft.lecturerName}
              onChange={(event) => updateDraft({ lecturerName: event.target.value })}
              className={SELECT_CLASSES}
            >
              <option value="">{t('reviews.notSpecified')}</option>
              {options.lecturers.map((lecturer) => (
                <option key={lecturer} value={lecturer}>
                  {lecturer}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <label className="grid min-w-0 gap-1.5">
        <span className="text-[12.5px] font-medium text-fg">{t('reviews.commentLabel')}</span>
        <textarea
          value={draft.comment}
          maxLength={MAX_COMMENT_LENGTH}
          rows={4}
          placeholder={t('reviews.commentPlaceholder')}
          onChange={(event) => updateDraft({ comment: event.target.value })}
          className="w-full min-w-0 max-w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] leading-5 text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <details className="min-w-0 rounded-[10px] border border-border-light bg-surface px-3 py-2 text-[12px] text-fg-mid">
        <summary className="cursor-pointer font-medium text-fg">{t('reviews.rulesTitle')}</summary>
        <ul className="mt-2 grid list-disc gap-1 pl-4">
          <li>{t('reviews.rulesRelevant')}</li>
          <li>{t('reviews.rulesProhibited')}</li>
          <li>{t('reviews.rulesModeration')}</li>
        </ul>
        <Link to={ROUTES.reviewRules} className="mt-2 inline-block font-medium text-primary hover:underline">
          {t('reviews.rulesReadFull')}
        </Link>
      </details>

      {errorMessage ? (
        <div className="rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
          {errorMessage}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-md bg-primary px-3.5 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isSaving ? t('reviews.saving') : t('reviews.submit')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="rounded-md border border-border px-3.5 py-1.5 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {t('reviews.cancel')}
        </button>
        {existingReview ? (
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={isSaving}
            className="rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-60 sm:ml-auto"
          >
            {t('reviews.delete')}
          </button>
        ) : null}
      </div>
    </form>
  )
}
