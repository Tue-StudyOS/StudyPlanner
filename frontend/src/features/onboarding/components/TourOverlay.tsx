import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from '../../i18n'
import { buildTourSteps } from '../steps'
import type { SpotlightRect } from '../utils/spotlight.ts'

const TARGET_SEARCH_TIMEOUT_MS = 2500
const OPTIONAL_TARGET_SEARCH_TIMEOUT_MS = 1500
const TARGET_POLL_INTERVAL_MS = 80
const SPOTLIGHT_PADDING = 8
const TOOLTIP_MAX_WIDTH = 360
const MOBILE_VIEWPORT_QUERY = '(max-width: 640px)'
// Targets are scrolled so their top sits just below the top bar; the
// explanation card then keeps its fixed spot at the bottom of the screen.
const TARGET_TOP_OFFSET_PX = 96
const ESTIMATED_CARD_HEIGHT_PX = 200
const CARD_BOTTOM_MARGIN_PX = 28
const TOUR_ACTIVE_CLASS_NAME = 'studyplanner-tour-active'
const SCROLL_LOCK_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'])

interface ScrollSnapshot {
  pathname: string
  windowX: number
  windowY: number
  documentTop: number
  bodyTop: number
  roots: Array<{ element: HTMLElement; top: number; left: number }>
}

function captureScrollSnapshot(): ScrollSnapshot {
  return {
    pathname: window.location.pathname,
    windowX: window.scrollX,
    windowY: window.scrollY,
    documentTop: document.documentElement.scrollTop,
    bodyTop: document.body.scrollTop,
    roots: Array.from(document.querySelectorAll<HTMLElement>('[data-tour-scroll-root]')).map((element) => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft,
    })),
  }
}

function restoreScrollSnapshot(snapshot: ScrollSnapshot): void {
  if (snapshot.pathname !== window.location.pathname) {
    return
  }
  window.scrollTo(snapshot.windowX, snapshot.windowY)
  document.documentElement.scrollTop = snapshot.documentTop
  document.body.scrollTop = snapshot.bodyTop
  snapshot.roots.forEach(({ element, top, left }) => {
    element.scrollTop = top
    element.scrollLeft = left
  })
}

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

function scrollTargetIntoPosition(element: Element, targetTopOffsetPx: number = TARGET_TOP_OFFSET_PX): void {
  const scrollParent = findScrollParent(element)
  const delta = element.getBoundingClientRect().top - targetTopOffsetPx
  scrollParent.scrollTop += delta
}

function measureSpotlight(element: Element, padding: number = SPOTLIGHT_PADDING): SpotlightRect {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function getAppContentTopPx(): number {
  const topBar = document.querySelector<HTMLElement>('[data-app-topbar]')
  return topBar?.getBoundingClientRect().bottom ?? 0
}

function clampSpotlightToContent(rect: SpotlightRect, contentTop: number): SpotlightRect {
  if (rect.top >= contentTop) {
    return rect
  }
  const clippedBy = contentTop - rect.top
  return {
    ...rect,
    top: contentTop,
    height: Math.max(0, rect.height - clippedBy),
  }
}

function spotlightFrameStyle(rect: SpotlightRect, contentTop: number): Record<string, string> {
  return {
    top: `${rect.top - contentTop}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.58), 0 18px 44px rgba(0, 0, 0, 0.34)',
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
  const stableHeightClassName = 'min-h-[9.75rem] sm:min-h-[13.5rem]'

  return (
    <div
      style={{ maxWidth: `${TOOLTIP_MAX_WIDTH}px` }}
      className={`pointer-events-auto flex w-full flex-col rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-2xl sm:px-5 sm:py-4.5 ${stableHeightClassName}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[14px] font-semibold leading-snug text-fg sm:text-[15px]">{step.title}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="shrink-0 rounded-md px-2 py-1 text-[11.5px] font-medium text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg sm:text-[12px]"
        >
          {t('common.skip')}
        </button>
      </div>
      <p className="mt-1 flex-1 text-[12.5px] leading-5 text-fg-mid sm:mt-1.5 sm:text-[13px] sm:leading-6">{step.body}</p>

      <div className="mt-2.5 flex items-center justify-between gap-3 sm:mt-3.5">
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
              className="rounded-md border border-border px-2.5 py-1.25 text-[12px] font-medium text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg sm:px-3 sm:py-1.5 sm:text-[12.5px]"
            >
              {t('common.back')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-3 py-1.25 text-[12px] font-medium text-white transition-opacity hover:opacity-90 sm:px-3.5 sm:py-1.5 sm:text-[12.5px]"
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
export function TourOverlay({
  onClose,
  onStepChange,
}: {
  onClose: () => void
  onStepChange: (stepId: string) => void
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const isMobileViewport = typeof window !== 'undefined'
    && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
  // Memoize so step objects stay referentially stable across renders; otherwise
  // the locate/track effects would reset the spotlight on every render.
  const allSteps = useMemo(() => buildTourSteps(t), [t])
  const steps = useMemo(
    () => allSteps.filter((candidate) => !candidate.viewport || candidate.viewport === (isMobileViewport ? 'mobile' : 'desktop')),
    [allSteps, isMobileViewport],
  )
  const [stepIndex, setStepIndex] = useState<number>(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [isSpotlightTargetInTopBar, setIsSpotlightTargetInTopBar] = useState<boolean>(false)
  const targetElementRef = useRef<Element | null>(null)
  const pendingScrollSnapshotRef = useRef<ScrollSnapshot | null>(null)
  const stepScrollSnapshotsRef = useRef<Map<string, ScrollSnapshot>>(new Map())
  const safeStepIndex = Math.min(stepIndex, steps.length - 1)
  const step = steps[safeStepIndex]
  const isLastStep = safeStepIndex >= steps.length - 1
  const shouldPreserveScroll = Boolean(
    step.preserveScroll && !(step.allowMobileScroll && isMobileViewport),
  )

  const closeTour = useCallback((): void => {
    onClose()
  }, [onClose])

  useLayoutEffect(() => {
    onStepChange(step.id)
  }, [onStepChange, step.id])

  useLayoutEffect(() => {
    if (!shouldPreserveScroll || step.resetScroll) {
      return
    }
    const snapshot = stepScrollSnapshotsRef.current.get(step.id) ?? pendingScrollSnapshotRef.current
    if (!snapshot) {
      return
    }
    restoreScrollSnapshot(snapshot)
    window.setTimeout(() => restoreScrollSnapshot(snapshot), 0)
  }, [shouldPreserveScroll, step.id, step.resetScroll])

  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route)
    }
  }, [location.pathname, navigate, step.route])

  useLayoutEffect(() => {
    if (!step.resetScroll) {
      return
    }
    if (step.route && location.pathname !== step.route) {
      return
    }
    scrollPageToTop()
    window.setTimeout(scrollPageToTop, 0)
  }, [location.pathname, step.resetScroll, step.route])

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

  // Locate the live DOM target. Some adjacent catalog steps intentionally keep
  // the page still and only move the spotlight frame.
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

    function locateTarget(): void {
      if (isCancelled) {
        return
      }
      const element = (step.targets ?? [])
        .map((target) => document.querySelector(`[data-tour="${target}"]`))
        .find((candidate): candidate is Element => candidate !== null)
      if (element) {
        if (shouldPreserveScroll && !step.resetScroll) {
          const snapshot = stepScrollSnapshotsRef.current.get(step.id) ?? pendingScrollSnapshotRef.current
          if (snapshot) {
            restoreScrollSnapshot(snapshot)
          }
        }
        targetElementRef.current = element
        setIsSpotlightTargetInTopBar(Boolean(element.closest('[data-app-topbar]')))
        if (!shouldPreserveScroll) {
          scrollTargetIntoPosition(
            element,
            isMobileViewport ? step.mobileTargetTopOffsetPx ?? step.targetTopOffsetPx : step.targetTopOffsetPx,
          )
        }
        window.setTimeout(() => {
          if (!isCancelled) {
            stepScrollSnapshotsRef.current.set(step.id, captureScrollSnapshot())
          }
        }, 0)
        return
      }
      if (Date.now() - searchStartedAt < searchTimeoutMs) {
        window.setTimeout(locateTarget, TARGET_POLL_INTERVAL_MS)
      }
    }
    const initialLocateTimeoutId = window.setTimeout(locateTarget, step.resetScroll ? 80 : 0)

    return () => {
      isCancelled = true
      window.clearTimeout(initialLocateTimeoutId)
    }
  }, [isMobileViewport, location.pathname, shouldPreserveScroll, step])

  // Live-track the highlighted target so the spotlight never drifts even if
  // the page shifts or scrolls.
  useEffect(() => {
    let frameId = 0
    let latest: SpotlightRect | null = null

    function track(): void {
      const element = targetElementRef.current
      if (element) {
        const next = measureSpotlight(element, step.spotlightPaddingPx ?? SPOTLIGHT_PADDING)
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

  const goBack = (): void => {
    const snapshot = captureScrollSnapshot()
    stepScrollSnapshotsRef.current.set(step.id, snapshot)
    pendingScrollSnapshotRef.current = snapshot
    setStepIndex((index) => Math.max(0, index - 1))
  }
  const goNext = (): void => {
    if (isLastStep) {
      closeTour()
      return
    }
    const snapshot = captureScrollSnapshot()
    stepScrollSnapshotsRef.current.set(step.id, snapshot)
    pendingScrollSnapshotRef.current = snapshot
    setStepIndex((index) => Math.min(index + 1, steps.length - 1))
  }

  // The card lives at the bottom by default. It only flips to the top when the
  // highlighted element itself sits low on screen and cannot be scrolled up —
  // i.e. when leaving the card at the bottom would cover it.
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const estimatedCardHeight = isMobileViewport ? 156 : ESTIMATED_CARD_HEIGHT_PX
  const bottomCardTop = viewportHeight - estimatedCardHeight - CARD_BOTTOM_MARGIN_PX
  const appContentTopPx = !spotlight || isSpotlightTargetInTopBar ? 0 : getAppContentTopPx()
  const visibleSpotlight = spotlight && appContentTopPx > 0
    ? clampSpotlightToContent(spotlight, appContentTopPx)
    : spotlight
  const spotlightStartsLow = Boolean(visibleSpotlight && visibleSpotlight.top > bottomCardTop)
  const hasHighlight = Boolean(step.targets && step.targets.length > 0)
  const cardZoneClassName = !hasHighlight
    ? 'absolute inset-0 flex items-center justify-center px-4'
    : spotlightStartsLow
      ? 'absolute inset-x-0 top-5 flex justify-center px-4'
      : 'absolute inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex justify-center px-4'

  return (
    <div
      className="fixed inset-0 z-[90] overscroll-contain"
      style={{ touchAction: 'none' }}
    >
      {/* Shield keeps the page inert while the tour is open. */}
      <div className="absolute inset-0" />

      {visibleSpotlight ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
          style={{ top: `${appContentTopPx}px` }}
        >
          <div
            className="absolute rounded-[14px] border-2 border-white/90 bg-white/5"
            style={spotlightFrameStyle(visibleSpotlight, appContentTopPx)}
          />
        </div>
      ) : (
        <div
          className={hasHighlight ? 'absolute inset-x-0 bottom-0 bg-black/55' : 'absolute inset-0 bg-black/55'}
          style={hasHighlight ? { top: `${getAppContentTopPx()}px` } : undefined}
        />
      )}

      <div className={`pointer-events-none ${cardZoneClassName}`}>
        <TourCard stepIndex={safeStepIndex} steps={steps} onBack={goBack} onNext={goNext} onClose={closeTour} />
      </div>
    </div>
  )
}
