import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '../../../shared/utils/errorMessage.ts'
import { useTranslation } from '../../i18n'
import type { TranslationKey } from '../../i18n/translations'
import { submitCourseReviewNotice } from '../api.ts'
import type { ReviewNoticeCategory } from '../types.ts'
import {
  MAX_NOTICE_ALLEGATION_LENGTH,
  MAX_NOTICE_EXPLANATION_LENGTH,
  buildReviewNoticePayload,
  validateReviewNoticeDraft,
  type ReviewNoticeDraft,
  type ReviewNoticeDraftError,
} from '../utils/reviewNoticeValidation.ts'

interface ReviewNoticeFormProps {
  reviewId: number
  defaultCategory?: ReviewNoticeCategory
  onCancel?: () => void
}

const CATEGORIES: { value: ReviewNoticeCategory; label: TranslationKey }[] = [
  { value: 'illegal_content', label: 'reviews.reportCategoryIllegal' },
  { value: 'privacy', label: 'reviews.reportCategoryPrivacy' },
  { value: 'harassment', label: 'reviews.reportCategoryHarassment' },
  { value: 'defamation', label: 'reviews.reportCategoryDefamation' },
  { value: 'off_topic', label: 'reviews.reportCategoryOffTopic' },
  { value: 'other', label: 'reviews.reportCategoryOther' },
]

const ERROR_KEYS: Record<ReviewNoticeDraftError, TranslationKey> = {
  missingCategory: 'reviews.reportErrorCategory',
  invalidAllegation: 'reviews.reportErrorAllegation',
  invalidExplanation: 'reviews.reportErrorExplanation',
  invalidEmail: 'reviews.reportErrorEmail',
  goodFaithRequired: 'reviews.reportErrorGoodFaith',
}

export function ReviewNoticeForm({
  reviewId,
  defaultCategory,
  onCancel,
}: ReviewNoticeFormProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<ReviewNoticeDraft>({
    category: defaultCategory ?? '',
    allegation: '',
    explanation: '',
    contactEmail: '',
    goodFaith: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reference, setReference] = useState<string | null>(null)

  function updateDraft(patch: Partial<ReviewNoticeDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const validationError = validateReviewNoticeDraft(draft)
    if (validationError) {
      setError(t(ERROR_KEYS[validationError]))
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const receipt = await submitCourseReviewNotice(buildReviewNoticePayload(reviewId, draft))
      setReference(receipt.notice.reference)
    } catch (cause) {
      setError(getErrorMessage(cause, t('reviews.reportErrorSubmit')))
    } finally {
      setIsSubmitting(false)
    }
  }

  if (reference) {
    return (
      <div className="min-w-0 rounded-[10px] border border-primary/30 bg-primary-soft px-3 py-2.5 text-[12.5px] text-fg">
        <p className="break-words">{t('reviews.reportReceipt', { reference })}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid min-w-0 gap-3 rounded-[10px] border border-border bg-surface px-3 py-3">
      <p className="text-[12.5px] font-medium text-fg">{t('reviews.reportTitle')}</p>
      <label className="grid min-w-0 gap-1">
        <span className="text-[11.5px] text-fg-mid">{t('reviews.reportCategory')}</span>
        <select
          value={draft.category}
          onChange={(event) => updateDraft({ category: event.target.value as ReviewNoticeCategory })}
          className="w-full min-w-0 max-w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg"
        >
          <option value="">{t('reviews.reportCategoryPlaceholder')}</option>
          {defaultCategory === 'moderation_redress' ? (
            <option value="moderation_redress">{t('reviews.reportCategoryRedress')}</option>
          ) : null}
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>{t(category.label)}</option>
          ))}
        </select>
      </label>
      <label className="grid min-w-0 gap-1">
        <span className="text-[11.5px] text-fg-mid">{t('reviews.reportAllegation')}</span>
        <input
          value={draft.allegation}
          maxLength={MAX_NOTICE_ALLEGATION_LENGTH}
          onChange={(event) => updateDraft({ allegation: event.target.value })}
          className="w-full min-w-0 max-w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg"
        />
      </label>
      <label className="grid min-w-0 gap-1">
        <span className="text-[11.5px] text-fg-mid">{t('reviews.reportExplanation')}</span>
        <textarea
          value={draft.explanation}
          maxLength={MAX_NOTICE_EXPLANATION_LENGTH}
          rows={4}
          onChange={(event) => updateDraft({ explanation: event.target.value })}
          className="w-full min-w-0 max-w-full resize-y rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg"
        />
      </label>
      <label className="grid min-w-0 gap-1">
        <span className="text-[11.5px] text-fg-mid">{t('reviews.reportEmail')}</span>
        <input
          type="email"
          value={draft.contactEmail}
          maxLength={254}
          onChange={(event) => updateDraft({ contactEmail: event.target.value })}
          className="w-full min-w-0 max-w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] text-fg"
        />
      </label>
      <label className="flex min-w-0 items-start gap-2 text-[11.5px] text-fg-mid">
        <input
          type="checkbox"
          checked={draft.goodFaith}
          onChange={(event) => updateDraft({ goodFaith: event.target.checked })}
          className="mt-0.5 shrink-0"
        />
        <span className="min-w-0 break-words">{t('reviews.reportGoodFaith')}</span>
      </label>
      {error ? <p className="break-words text-[12px] text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={isSubmitting} className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-60">
          {isSubmitting ? t('common.pleaseWait') : t('reviews.reportSubmit')}
        </button>
        {onCancel ? <button type="button" onClick={onCancel} disabled={isSubmitting} className="rounded-md border border-border px-3 py-1.5 text-[12.5px] text-fg">{t('common.cancel')}</button> : null}
      </div>
    </form>
  )
}
