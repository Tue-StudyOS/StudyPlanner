import { useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { CloseIcon } from '../../../shared/components/icons'
import { StarRating } from '../../../shared/components/StarRating'
import { useTranslation } from '../../i18n'
import { useOnboarding } from '../../onboarding'
import { submitFeedback } from '../api.ts'

const MAX_FEEDBACK_LENGTH = 2000

type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'

function buildPagePath(location: { pathname: string }): string {
  return location.pathname.slice(0, 512) || '/'
}

export function FeedbackWidget() {
  const { t } = useTranslation()
  const { isOpen: isOnboardingOpen } = useOnboarding()
  const location = useLocation()
  const pagePath = useMemo(() => buildPagePath(location), [location])

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [rating, setRating] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  if (isOnboardingOpen) {
    return null
  }

  function openFromButton(): void {
    setSubmissionState('idle')
    setErrorMessage('')
    setIsOpen(true)
  }

  function closeModal(): void {
    if (submissionState === 'submitting') {
      return
    }
    setIsOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const trimmedMessage = message.trim()

    if (rating < 1 || rating > 5) {
      setSubmissionState('error')
      setErrorMessage(t('feedback.ratingRequired'))
      return
    }
    if (trimmedMessage.length < 3) {
      setSubmissionState('error')
      setErrorMessage(t('feedback.textRequired'))
      return
    }

    setSubmissionState('submitting')
    setErrorMessage('')

    try {
      await submitFeedback({
        rating,
        message: trimmedMessage,
        pagePath,
      })
      setSubmissionState('success')
      setMessage('')
      setRating(0)
    } catch (error) {
      setSubmissionState('error')
      setErrorMessage(error instanceof Error ? error.message : t('feedback.submitFailed'))
    }
  }

  const widget = (
    <>
      <button
        type="button"
        onClick={openFromButton}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 z-40 rounded-full border border-border bg-surface/95 px-3 py-1.5 text-[11.5px] font-medium text-fg-mid shadow-lg shadow-black/10 backdrop-blur-sm transition-colors hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-muted focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:right-5 sm:px-4 sm:py-2 sm:text-[12.5px] md:right-6"
      >
        {t('feedback.button')}
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[95] overflow-y-auto bg-black/45 px-4 py-6 sm:py-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          onClick={closeModal}
        >
          <div
            className="mx-auto flex min-h-full w-full max-w-[30rem] items-center"
            onClick={(event) => event.stopPropagation()}
          >
            <form
              onSubmit={handleSubmit}
              className="w-full rounded-[16px] border border-border bg-surface p-5 shadow-2xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id="feedback-dialog-title" className="text-[18px] font-semibold text-fg">
                    {t('feedback.title')}
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                    {t('feedback.description')}
                  </p>
                  <p className="mt-2 rounded-[10px] border border-border-light bg-surface-hover px-3 py-2 text-[12.5px] leading-relaxed text-fg-muted">
                    {t('feedback.anonymousNotice')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submissionState === 'submitting'}
                  aria-label={t('common.close')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CloseIcon />
                </button>
              </div>

              {submissionState === 'success' ? (
                <div className="rounded-[10px] border border-border bg-surface-hover px-4 py-3 text-[13px] text-fg">
                  {t('feedback.success')}
                </div>
              ) : (
                <>
                  <label className="mb-4 block">
                    <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                      {t('feedback.ratingLabel')}
                    </span>
                    <StarRating
                      value={rating}
                      label={t('feedback.ratingLabel')}
                      onChange={setRating}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                      {t('feedback.textLabel')}
                    </span>
                    <textarea
                      value={message}
                      maxLength={MAX_FEEDBACK_LENGTH}
                      rows={5}
                      onChange={(event) => setMessage(event.target.value)}
                      placeholder={t('feedback.textPlaceholder')}
                      className="w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2.5 text-[13.5px] leading-relaxed text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
                    />
                    <span className="mt-1 block text-right text-[11px] text-fg-muted">
                      {message.length}/{MAX_FEEDBACK_LENGTH}
                    </span>
                  </label>

                  {submissionState === 'error' ? (
                    <div className="mt-3 rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-[12.5px] text-danger">
                      {errorMessage || t('feedback.submitFailed')}
                    </div>
                  ) : null}
                </>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                {submissionState === 'success' ? (
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-hover"
                  >
                    {t('common.close')}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={submissionState === 'submitting'}
                      className="rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('feedback.later')}
                    </button>
                    <button
                      type="submit"
                      disabled={submissionState === 'submitting'}
                      className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submissionState === 'submitting' ? t('feedback.submitting') : t('feedback.submit')}
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )

  // ponytail: portal keeps fixed positioning reliable on iOS Safari inside flex/overflow shells.
  return createPortal(widget, document.body)
}
