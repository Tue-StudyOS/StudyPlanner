import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ONBOARDING_STEPS } from '../steps'
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from './icons'

interface OnboardingModalProps {
  onClose: () => void
}

export function OnboardingModal({ onClose }: OnboardingModalProps) {
  const navigate = useNavigate()
  const [stepIndex, setStepIndex] = useState<number>(0)
  const step = ONBOARDING_STEPS[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1
  const StepIcon = step.Icon

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Switch the background page to match the step being explained. Steps without a
  // route (e.g. welcome) leave the user on their current page. `replace` keeps the
  // browser history clean while clicking through the guide.
  useEffect(() => {
    if (step.route) navigate(step.route, { replace: true })
  }, [step.route, navigate])

  const goBack = (): void => setStepIndex((index) => Math.max(0, index - 1))
  const goNext = (): void => {
    if (isLastStep) {
      onClose()
      return
    }
    setStepIndex((index) => Math.min(ONBOARDING_STEPS.length - 1, index + 1))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-[16px] border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close guide"
          className="absolute right-3.5 top-3.5 flex items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
        >
          <CloseIcon />
        </button>

        <div className="px-6 pt-7 sm:px-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
            <StepIcon />
          </div>

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {step.eyebrow}
          </div>
          <h2
            id="onboarding-title"
            className="mt-1.5 font-serif text-[22px] font-semibold leading-tight tracking-[-0.02em] text-fg"
          >
            {step.title}
          </h2>

          <p className="mt-3 text-[13.5px] leading-7 text-fg-mid">{step.description}</p>

          {step.bullets ? (
            <ul className="mt-3 flex flex-col gap-2">
              {step.bullets.map((bullet) => (
                <li key={bullet} className="flex items-baseline gap-2.5 text-[13.5px] leading-6 text-fg-mid">
                  <span className="mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="mt-7 flex items-center justify-between gap-4 border-t border-border-light px-6 py-4 sm:px-8">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {ONBOARDING_STEPS.map((dotStep, index) => (
              <span
                key={dotStep.id}
                className={`h-1.5 rounded-full transition-all ${
                  index === stepIndex ? 'w-5 bg-primary' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {isFirstStep ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-[13px] font-medium text-fg-mid transition-colors hover:text-fg"
              >
                Skip
              </button>
            ) : (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-2 text-[13px] font-medium text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
              >
                <ArrowLeftIcon />
                Back
              </button>
            )}

            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-80"
            >
              {isLastStep ? 'Get started' : 'Next'}
              {isLastStep ? null : <ArrowRightIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
