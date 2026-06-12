import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { TOUR_STEPS } from '../steps'

const TARGET_SEARCH_TIMEOUT_MS = 2500
const TARGET_POLL_INTERVAL_MS = 120
const SPOTLIGHT_PADDING = 8
const TOOLTIP_WIDTH = 330
const TOOLTIP_CLEARANCE = 190

interface SpotlightRect {
  top: number
  left: number
  width: number
  height: number
}

function TourCard({
  stepIndex,
  onBack,
  onNext,
  onClose,
  style,
  className,
}: {
  stepIndex: number
  onBack: () => void
  onNext: () => void
  onClose: () => void
  style?: React.CSSProperties
  className?: string
}) {
  const step = TOUR_STEPS[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  return (
    <div
      style={style}
      className={`pointer-events-auto rounded-[14px] border border-border bg-surface px-5 py-4.5 shadow-2xl ${className ?? ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          {stepIndex + 1} / {TOUR_STEPS.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          Skip
        </button>
      </div>

      <div className="text-[15px] font-semibold leading-snug text-fg">{step.title}</div>
      <p className="mt-1.5 text-[13px] leading-6 text-fg-mid">{step.body}</p>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1" aria-hidden="true">
          {TOUR_STEPS.map((dotStep, index) => (
            <span
              key={dotStep.id}
              className={`h-1 rounded-full transition-all ${
                index === stepIndex ? 'w-4 bg-primary' : 'w-1 bg-border'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isFirstStep ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-medium text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
            >
              Back
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {isLastStep ? 'Start planning' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Guided tour that highlights live UI: it navigates to the step's screen,
 * spotlights the real element via a cutout overlay, and explains it in place.
 * Steps without a (findable) target fall back to a centered card.
 */
export function TourOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const isMobileViewport = useMediaQuery('(max-width: 640px)')
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const targetElementRef = useRef<Element | null>(null)
  const step = TOUR_STEPS[stepIndex]
  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [location.pathname, navigate, step.route])

  useEffect(() => {
    targetElementRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while the new target is located
    setSpotlight(null)
    if (!step.targets || step.targets.length === 0) {
      return
    }
    if (step.route && location.pathname !== step.route) {
      return
    }

    let isCancelled = false
    const searchStartedAt = Date.now()

    function measure(element: Element): void {
      const rect = element.getBoundingClientRect()
      setSpotlight({
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      })
    }

    function locateTarget(): void {
      if (isCancelled) {
        return
      }
      const element = (step.targets ?? [])
        .map((target) => document.querySelector(`[data-tour="${target}"]`))
        .find((candidate): candidate is Element => candidate !== null)
      if (element) {
        targetElementRef.current = element
        element.scrollIntoView({ block: 'center' })
        requestAnimationFrame(() => {
          if (!isCancelled) {
            measure(element)
          }
        })
        return
      }
      if (Date.now() - searchStartedAt < TARGET_SEARCH_TIMEOUT_MS) {
        window.setTimeout(locateTarget, TARGET_POLL_INTERVAL_MS)
      }
    }
    locateTarget()

    function handleViewportChange(): void {
      if (targetElementRef.current) {
        measure(targetElementRef.current)
      }
    }
    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [location.pathname, step])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight' && !isLastStep) setStepIndex((index) => index + 1)
      if (event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex((index) => index - 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLastStep, onClose, stepIndex])

  const goBack = (): void => setStepIndex((index) => Math.max(0, index - 1))
  const goNext = (): void => {
    if (isLastStep) {
      onClose()
      return
    }
    setStepIndex((index) => index + 1)
  }

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const tooltipStyle: React.CSSProperties | undefined =
    spotlight && !isMobileViewport
      ? {
          position: 'fixed',
          width: `${TOOLTIP_WIDTH}px`,
          left: `${Math.min(Math.max(spotlight.left, 12), viewportWidth - TOOLTIP_WIDTH - 12)}px`,
          ...(spotlight.top + spotlight.height + TOOLTIP_CLEARANCE < viewportHeight
            ? { top: `${spotlight.top + spotlight.height + 12}px` }
            : { bottom: `${viewportHeight - spotlight.top + 12}px` }),
        }
      : undefined

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Shield keeps the page inert while the tour is open. */}
      <div className="absolute inset-0" />

      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-[12px] border-2 border-white/75 transition-all duration-200"
          style={{
            top: `${spotlight.top}px`,
            left: `${spotlight.left}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {spotlight && !isMobileViewport ? (
        <TourCard
          stepIndex={stepIndex}
          onBack={goBack}
          onNext={goNext}
          onClose={onClose}
          style={tooltipStyle}
        />
      ) : spotlight && isMobileViewport ? (
        <TourCard
          stepIndex={stepIndex}
          onBack={goBack}
          onNext={goNext}
          onClose={onClose}
          className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <TourCard
            stepIndex={stepIndex}
            onBack={goBack}
            onNext={goNext}
            onClose={onClose}
            className="w-full max-w-[26rem]"
          />
        </div>
      )}
    </div>
  )
}
