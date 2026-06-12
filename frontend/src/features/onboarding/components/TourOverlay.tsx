import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ROUTES } from '../../routes'
import { TOUR_STEPS } from '../steps'

const TARGET_SEARCH_TIMEOUT_MS = 2500
const TARGET_POLL_INTERVAL_MS = 120
const SPOTLIGHT_PADDING = 8
const TOOLTIP_MAX_WIDTH = 360

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
  className,
}: {
  stepIndex: number
  onBack: () => void
  onNext: () => void
  onClose: () => void
  className?: string
}) {
  const step = TOUR_STEPS[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === TOUR_STEPS.length - 1

  return (
    <div
      style={{ maxWidth: `${TOOLTIP_MAX_WIDTH}px` }}
      className={`pointer-events-auto w-full rounded-[14px] border border-border bg-surface px-5 py-4.5 shadow-2xl ${className ?? ''}`}
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
            {isLastStep ? 'Start in the catalog' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Guided tour that highlights live UI. The spotlight is measured once after
 * the target is scrolled into place and then frozen — page scrolling is
 * locked while the tour runs, so the box never drifts or follows.
 */
export function TourOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
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

  // Lock page scrolling while the tour is open so the frozen spotlight and
  // the page can never drift apart.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

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
        // Measure once after the scroll settles, then freeze the box.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!isCancelled) {
              measure(element)
            }
          })
        })
        return
      }
      if (Date.now() - searchStartedAt < TARGET_SEARCH_TIMEOUT_MS) {
        window.setTimeout(locateTarget, TARGET_POLL_INTERVAL_MS)
      }
    }
    locateTarget()

    function handleResize(): void {
      if (targetElementRef.current) {
        targetElementRef.current.scrollIntoView({ block: 'center' })
        requestAnimationFrame(() => measure(targetElementRef.current as Element))
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      isCancelled = true
      window.removeEventListener('resize', handleResize)
    }
  }, [location.pathname, step])

  function finishTour(): void {
    onClose()
    navigate(ROUTES.catalog)
  }

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
      finishTour()
      return
    }
    setStepIndex((index) => index + 1)
  }

  // The card sits centered inside the larger free region (above or below the
  // spotlight) instead of clinging to the target. When the spotlight fills
  // the screen, fall back to centering over everything.
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const spaceAbove = spotlight ? Math.max(spotlight.top, 0) : 0
  const spaceBelow = spotlight ? Math.max(viewportHeight - (spotlight.top + spotlight.height), 0) : 0
  const useFreeArea = spotlight !== null && Math.max(spaceAbove, spaceBelow) >= 240
  const freeAreaStyle: React.CSSProperties | undefined = spotlight && useFreeArea
    ? spaceBelow >= spaceAbove
      ? { top: `${spotlight.top + spotlight.height}px`, bottom: 0 }
      : { top: 0, bottom: `${viewportHeight - spotlight.top}px` }
    : undefined

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Shield keeps the page inert while the tour is open. */}
      <div className="absolute inset-0" />

      {spotlight ? (
        <div
          className="pointer-events-none absolute rounded-[12px] border-2 border-white/75"
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

      {useFreeArea ? (
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center justify-center px-4 py-3"
          style={freeAreaStyle}
        >
          <TourCard stepIndex={stepIndex} onBack={goBack} onNext={goNext} onClose={onClose} />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <TourCard stepIndex={stepIndex} onBack={goBack} onNext={goNext} onClose={onClose} />
        </div>
      )}
    </div>
  )
}
