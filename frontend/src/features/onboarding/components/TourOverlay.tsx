import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n'
import { buildTourSteps } from '../steps'
import {
  buildSpotlightFrameStyle,
  buildSpotlightHaloStyle,
  type SpotlightRect,
} from '../utils/spotlight.ts'

const TARGET_SEARCH_TIMEOUT_MS = 2500
const OPTIONAL_TARGET_SEARCH_TIMEOUT_MS = 1500
const TARGET_POLL_INTERVAL_MS = 80
const SPOTLIGHT_PADDING = 8
const TOOLTIP_MAX_WIDTH = 360
// Targets are scrolled to a fixed offset below the top bar so the card can
// always sit in the same bottom zone.
const TARGET_TOP_OFFSET_PX = 110
const CARD_ZONE_HEIGHT_PX = 250
const ESTIMATED_CARD_HEIGHT_PX = 220

function findScrollParent(element: Element): Element {
  let parent = element.parentElement
  while (parent) {
    const style = window.getComputedStyle(parent)
    if (
      parent.scrollHeight > parent.clientHeight
      && (style.overflowY === 'auto' || style.overflowY === 'scroll')
    ) {
      return parent
    }
    parent = parent.parentElement
  }
  return document.scrollingElement ?? document.documentElement
}

function scrollTargetIntoPosition(element: Element): void {
  const scrollParent = findScrollParent(element)
  const delta = element.getBoundingClientRect().top - TARGET_TOP_OFFSET_PX
  scrollParent.scrollTop += delta
}

function TourCard({
  stepIndex,
  steps,
  onBack,
  onNext,
  onClose,
  className,
}: {
  stepIndex: number
  steps: ReturnType<typeof buildTourSteps>
  onBack: () => void
  onNext: () => void
  onClose: () => void
  className?: string
}) {
  const { t } = useTranslation()
  const step = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  return (
    <div
      style={{ maxWidth: `${TOOLTIP_MAX_WIDTH}px` }}
      className={`pointer-events-auto w-full rounded-[14px] border border-border bg-surface px-5 py-4.5 shadow-2xl ${className ?? ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[15px] font-semibold leading-snug text-fg">{step.title}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
        >
          {t('common.skip')}
        </button>
      </div>
      <p className="mt-1.5 text-[13px] leading-6 text-fg-mid">{step.body}</p>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1" aria-hidden="true">
          {steps.map((dotStep, index) => (
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
              {t('common.back')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
          >
            {isLastStep ? t('common.complete') : t('common.next')}
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
  const { t } = useTranslation()
  const steps = buildTourSteps(t)
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const targetElementRef = useRef<Element | null>(null)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

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
    const searchTimeoutMs = step.optional
      ? OPTIONAL_TARGET_SEARCH_TIMEOUT_MS
      : TARGET_SEARCH_TIMEOUT_MS

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
        scrollTargetIntoPosition(element)
        // Measure once after the scroll settles, then freeze the box.
        requestAnimationFrame(() => {
          if (!isCancelled) {
            measure(element)
          }
        })
        return
      }
      if (Date.now() - searchStartedAt < searchTimeoutMs) {
        window.setTimeout(locateTarget, TARGET_POLL_INTERVAL_MS)
        return
      }
      targetElementRef.current = null
    }
    locateTarget()

    function handleResize(): void {
      if (targetElementRef.current) {
        scrollTargetIntoPosition(targetElementRef.current)
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
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const goBack = (): void => setStepIndex((index) => Math.max(0, index - 1))
  const goNext = (): void => {
    if (isLastStep) {
      finishTour()
      return
    }
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  // Keep the card centered by default. Move it only when the current spotlight
  // would be hidden by the centered card.
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const spotlightBottom = spotlight ? spotlight.top + spotlight.height : 0
  const centeredCardTop = (viewportHeight - ESTIMATED_CARD_HEIGHT_PX) / 2
  const centeredCardBottom = centeredCardTop + ESTIMATED_CARD_HEIGHT_PX
  const centeredCardOverlapsSpotlight = Boolean(
    spotlight && spotlight.top < centeredCardBottom && spotlightBottom > centeredCardTop,
  )
  const cardZoneClassName = !centeredCardOverlapsSpotlight
    ? 'absolute inset-0 flex items-center justify-center px-4'
    : spotlightBottom < viewportHeight - CARD_ZONE_HEIGHT_PX
      ? 'absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex justify-center px-4'
      : 'absolute inset-x-0 top-5 flex justify-center px-4'

  return (
    <div className="fixed inset-0 z-[70]">
      {/* Shield keeps the page inert while the tour is open. */}
      <div className="absolute inset-0" />

      {spotlight ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[18px] border border-primary/70 opacity-90"
            style={buildSpotlightHaloStyle(spotlight)}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[14px] border-2 border-white/90 bg-white/5"
            style={buildSpotlightFrameStyle(spotlight)}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      {spotlight ? (
        <div className={`pointer-events-none ${cardZoneClassName}`}>
          <TourCard stepIndex={stepIndex} steps={steps} onBack={goBack} onNext={goNext} onClose={onClose} />
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4">
          <TourCard stepIndex={stepIndex} steps={steps} onBack={goBack} onNext={goNext} onClose={onClose} />
        </div>
      )}
    </div>
  )
}
