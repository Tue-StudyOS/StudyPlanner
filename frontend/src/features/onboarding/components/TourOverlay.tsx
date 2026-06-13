import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n'
import { buildTourSteps } from '../steps'
import { TourSampleCard } from './TourSampleCard'
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
// Targets are scrolled so their top sits just below the top bar; the
// explanation card then keeps its fixed spot at the bottom of the screen.
const TARGET_TOP_OFFSET_PX = 96
const ESTIMATED_CARD_HEIGHT_PX = 200
const CARD_BOTTOM_MARGIN_PX = 28
const TOUR_ACTIVE_CLASS_NAME = 'studyplanner-tour-active'
const SCROLL_LOCK_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

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

function measureSpotlight(element: Element): SpotlightRect {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  }
}

function rectsRoughlyEqual(a: SpotlightRect | null, b: SpotlightRect): boolean {
  if (!a) return false
  return (
    Math.abs(a.top - b.top) < 0.5
    && Math.abs(a.left - b.left) < 0.5
    && Math.abs(a.width - b.width) < 0.5
    && Math.abs(a.height - b.height) < 0.5
  )
}

function scrollPageToTop(): void {
  const scrollingElement = document.scrollingElement ?? document.documentElement
  scrollingElement.scrollTop = 0
  document.documentElement.scrollTop = 0
  document.body.scrollTop = 0
  window.scrollTo(0, 0)
}

function TourCard({
  stepIndex,
  steps,
  onBack,
  onNext,
  onClose,
}: {
  stepIndex: number
  steps: ReturnType<typeof buildTourSteps>
  onBack: () => void
  onNext: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const step = steps[stepIndex]
  const isFirstStep = stepIndex === 0
  const isLastStep = stepIndex === steps.length - 1

  return (
    <div
      style={{ maxWidth: `${TOOLTIP_MAX_WIDTH}px` }}
      className="pointer-events-auto w-full rounded-[14px] border border-border bg-surface px-5 py-4.5 shadow-2xl"
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
 * Guided tour that highlights live UI. The spotlight is live-measured every
 * frame so it stays glued to its target, and the explanation card keeps one
 * fixed position (bottom-center) instead of jumping around the screen.
 */
export function TourOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  // Memoize so step objects stay referentially stable across renders; otherwise
  // the locate/track effects would reset the spotlight on every render.
  const steps = useMemo(() => buildTourSteps(t), [t])
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const targetElementRef = useRef<Element | null>(null)
  const sampleElementRef = useRef<HTMLDivElement | null>(null)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1
  const isSampleStep = Boolean(step.sample)

  const closeTour = useCallback((): void => {
    if (step.id === 'reopen-guide') {
      scrollPageToTop()
      window.setTimeout(scrollPageToTop, 0)
    }
    onClose()
  }, [onClose, step.id])

  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [location.pathname, navigate, step.route])

  useEffect(() => {
    const { body, documentElement } = document
    const previousBodyOverflow = body.style.overflow
    const previousDocumentOverflow = documentElement.style.overflow
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior
    const previousDocumentOverscrollBehavior = documentElement.style.overscrollBehavior
    const hadTourActiveClass = documentElement.classList.contains(TOUR_ACTIVE_CLASS_NAME)
    const nonPassiveOptions: AddEventListenerOptions = { passive: false }

    function preventScroll(event: Event): void {
      event.preventDefault()
    }

    function preventScrollKey(event: KeyboardEvent): void {
      if (SCROLL_LOCK_KEYS.has(event.key)) {
        event.preventDefault()
      }
    }

    body.style.overflow = 'hidden'
    documentElement.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    documentElement.style.overscrollBehavior = 'none'
    documentElement.classList.add(TOUR_ACTIVE_CLASS_NAME)
    window.addEventListener('wheel', preventScroll, nonPassiveOptions)
    window.addEventListener('touchmove', preventScroll, nonPassiveOptions)
    window.addEventListener('keydown', preventScrollKey)

    return () => {
      body.style.overflow = previousBodyOverflow
      documentElement.style.overflow = previousDocumentOverflow
      body.style.overscrollBehavior = previousBodyOverscrollBehavior
      documentElement.style.overscrollBehavior = previousDocumentOverscrollBehavior
      if (!hadTourActiveClass) {
        documentElement.classList.remove(TOUR_ACTIVE_CLASS_NAME)
      }
      window.removeEventListener('wheel', preventScroll, nonPassiveOptions)
      window.removeEventListener('touchmove', preventScroll, nonPassiveOptions)
      window.removeEventListener('keydown', preventScrollKey)
    }
  }, [])

  // Locate the live DOM target for the current step and scroll it into place.
  useEffect(() => {
    targetElementRef.current = null
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset while the new target is located
    setSpotlight(null)
    if (step.sample || !step.targets || step.targets.length === 0) {
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
        return
      }
      if (Date.now() - searchStartedAt < searchTimeoutMs) {
        window.setTimeout(locateTarget, TARGET_POLL_INTERVAL_MS)
      }
    }
    locateTarget()

    return () => {
      isCancelled = true
    }
  }, [location.pathname, step])

  // Live-track whichever element this step highlights (sample replica or live
  // target), so the spotlight never drifts even if the page shifts or scrolls.
  useEffect(() => {
    let frameId = 0
    let latest: SpotlightRect | null = null

    function track(): void {
      const element = step.sample ? sampleElementRef.current : targetElementRef.current
      if (element) {
        const next = measureSpotlight(element)
        if (!rectsRoughlyEqual(latest, next)) {
          latest = next
          setSpotlight(next)
        }
      }
      frameId = window.requestAnimationFrame(track)
    }
    frameId = window.requestAnimationFrame(track)

    return () => window.cancelAnimationFrame(frameId)
  }, [step])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') closeTour()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeTour])

  const goBack = (): void => setStepIndex((index) => Math.max(0, index - 1))
  const goNext = (): void => {
    if (isLastStep) {
      closeTour()
      return
    }
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  // The card lives at the bottom by default. It only flips to the top when the
  // highlighted element itself sits low on screen and cannot be scrolled up —
  // i.e. when leaving the card at the bottom would cover it.
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const bottomCardTop = viewportHeight - ESTIMATED_CARD_HEIGHT_PX - CARD_BOTTOM_MARGIN_PX
  const spotlightStartsLow = Boolean(spotlight && spotlight.top > bottomCardTop)
  const hasHighlight = Boolean(step.sample || (step.targets && step.targets.length > 0))
  const cardZoneClassName = !hasHighlight
    ? 'absolute inset-0 flex items-center justify-center px-4'
    : spotlightStartsLow
      ? 'absolute inset-x-0 top-5 flex justify-center px-4'
      : 'absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex justify-center px-4'

  return (
    <div
      className={`fixed inset-0 ${isSampleStep ? 'z-[90]' : 'z-[70]'} overscroll-contain`}
      style={{ touchAction: 'none' }}
    >
      {isSampleStep ? <div aria-hidden="true" className="absolute inset-0 bg-bg" /> : null}

      {/* Shield keeps the page inert while the tour is open. */}
      <div className="absolute inset-0" />

      {spotlight ? (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute rounded-[18px] border border-white/45 opacity-90"
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

      {/* Example replica cards render above the dim so the spotlight frame can
          wrap them and the user always sees a correct example. */}
      {step.sample ? (
        <div className="pointer-events-none absolute inset-x-0 top-[16vh] flex justify-center px-4">
          <TourSampleCard variant={step.sample} innerRef={sampleElementRef} />
        </div>
      ) : null}

      <div className={`pointer-events-none ${cardZoneClassName}`}>
        <TourCard stepIndex={stepIndex} steps={steps} onBack={goBack} onNext={goNext} onClose={closeTour} />
      </div>
    </div>
  )
}
