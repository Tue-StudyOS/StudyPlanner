import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { CloseIcon } from '../../../shared/components/icons'
import { useTranslation } from '../../i18n'
import { useOnboarding } from '../../onboarding'
import { submitFeedback } from '../api.ts'
import {
  FEEDBACK_AUTO_PROMPT_DELAY_MS,
  shouldScheduleFeedbackPrompt,
} from '../utils/feedbackPrompt.ts'

const AUTO_PROMPT_SESSION_KEY = 'studyplanner.feedback.autoPromptSeen'
const SUBMITTED_STORAGE_KEY = 'studyplanner.feedback.submitted'
const MAX_FEEDBACK_LENGTH = 2000

type FeedbackSource = 'auto_prompt' | 'feedback_button'
type SubmissionState = 'idle' | 'submitting' | 'success' | 'error'

function readStorageValue(storage: Storage | undefined, key: string): boolean {
  if (!storage) {
    return false
  }
  try {
    return storage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function writeStorageValue(storage: Storage | undefined, key: string): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(key, 'true')
  } catch {
    // Storage can be unavailable in private browsing; the in-memory modal still works.
  }
}

function buildPagePath(location: { pathname: string }): string {
  return location.pathname.slice(0, 512) || '/'
}

function StarRating({ value, onChange }: { value: number; onChange: (rating: number) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Feedback rating">
      {[1, 2, 3, 4, 5].map((rating) => {
        const isActive = rating <= value
        return (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} star${rating === 1 ? '' : 's'}`}
            onClick={() => onChange(rating)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? 'border-primary bg-primary-soft text-primary'
                : 'border-border bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg'
            }`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}

export function FeedbackWidget() {
  const { t } = useTranslation()
  const { isOpen: isOnboardingOpen } = useOnboarding()
  const location = useLocation()
  const pagePath = useMemo(() => buildPagePath(location), [location])

  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [source, setSource] = useState<FeedbackSource>('feedback_button')
  const [rating, setRating] = useState<number>(0)
  const [message, setMessage] = useState<string>('')
  const [submissionState, setSubmissionState] = useState<SubmissionState>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const shouldSchedule = shouldScheduleFeedbackPrompt({
      hasSubmittedFeedback: readStorageValue(window.localStorage, SUBMITTED_STORAGE_KEY),
      hasSeenAutoPromptThisSession: readStorageValue(window.sessionStorage, AUTO_PROMPT_SESSION_KEY),
      isOnboardingOpen,
    })

    if (!shouldSchedule) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      writeStorageValue(window.sessionStorage, AUTO_PROMPT_SESSION_KEY)
      setSource('auto_prompt')
      setIsOpen(true)
    }, FEEDBACK_AUTO_PROMPT_DELAY_MS)

    return () => window.clearTimeout(timeoutId)
  }, [isOnboardingOpen])

  if (isOnboardingOpen) {
    return null
  }

  function openFromButton(): void {
    setSource('feedback_button')
    setSubmissionState('idle')
    setErrorMessage('')
    setIsOpen(true)
  }

  function closeModal(): void {
    if (submissionState === 'submitting') {
      return
    }
    if (source === 'auto_prompt' && typeof window !== 'undefined') {
      writeStorageValue(window.sessionStorage, AUTO_PROMPT_SESSION_KEY)
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
        source,
      })
      if (typeof window !== 'undefined') {
        writeStorageValue(window.localStorage, SUBMITTED_STORAGE_KEY)
        writeStorageValue(window.sessionStorage, AUTO_PROMPT_SESSION_KEY)
      }
      setSubmissionState('success')
      setMessage('')
      setRating(0)
    } catch (error) {
      setSubmissionState('error')
      setErrorMessage(error instanceof Error ? error.message : t('feedback.submitFailed'))
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openFromButton}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 z-40 rounded-full border border-border bg-surface px-4 py-2 text-[12.5px] font-medium text-fg-mid shadow-lg shadow-black/10 transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-muted focus-visible:ring-offset-2 focus-visible:ring-offset-bg sm:right-5 md:right-6"
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
                    <StarRating value={rating} onChange={setRating} />
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
}
