import type { TranslationKey } from '../i18n/translations.ts'
import { ROUTES } from '../routes.ts'
import type { TourStep } from './types.ts'

interface TourStepDefinition extends Omit<TourStep, 'title' | 'body'> {
  titleKey: TranslationKey
  bodyKey: TranslationKey
}

/**
 * The tour walks through the real screens and highlights live UI instead of
 * describing it. Steps without targets render as a centered card.
 */
export const TOUR_STEP_DEFINITIONS: TourStepDefinition[] = [
  {
    id: 'welcome',
    titleKey: 'tour.welcome.title',
    bodyKey: 'tour.welcome.body',
  },
  {
    id: 'transcript',
    route: ROUTES.transcript,
    targets: ['transcript-upload', 'transcript-page'],
    preserveScroll: true,
    resetScroll: true,
    allowMobileScroll: true,
    titleKey: 'tour.transcript.title',
    bodyKey: 'tour.transcript.body',
  },
  {
    id: 'catalog-progress-hint',
    route: ROUTES.catalog,
    targets: ['catalog-progress-hint'],
    preserveScroll: true,
    resetScroll: true,
    spotlightPaddingPx: 0,
    titleKey: 'tour.catalogProgressHint.title',
    bodyKey: 'tour.catalogProgressHint.body',
  },
  {
    id: 'catalog-search',
    route: ROUTES.catalog,
    targets: ['catalog-search'],
    targetTopOffsetPx: 146,
    preserveScroll: true,
    resetScroll: true,
    titleKey: 'tour.catalogSearch.title',
    bodyKey: 'tour.catalogSearch.body',
  },
  {
    id: 'catalog-filters',
    route: ROUTES.catalog,
    targets: ['catalog-filters'],
    targetTopOffsetPx: 190,
    preserveScroll: true,
    titleKey: 'tour.catalogFilters.title',
    bodyKey: 'tour.catalogFilters.body',
  },
  {
    id: 'catalog-card',
    route: ROUTES.catalog,
    targets: ['catalog-sample-confirmed'],
    preserveScroll: true,
    allowMobileScroll: true,
    mobileTargetTopOffsetPx: 144,
    sample: 'confirmed',
    titleKey: 'tour.catalogCard.title',
    bodyKey: 'tour.catalogCard.body',
  },
  {
    id: 'catalog-card-likely',
    route: ROUTES.catalog,
    targets: ['catalog-sample-likely'],
    preserveScroll: true,
    allowMobileScroll: true,
    mobileTargetTopOffsetPx: 144,
    sample: 'likely',
    titleKey: 'tour.catalogLikely.title',
    bodyKey: 'tour.catalogLikely.body',
  },
  {
    id: 'catalog-card-unknown',
    route: ROUTES.catalog,
    targets: ['catalog-sample-unknown'],
    preserveScroll: true,
    allowMobileScroll: true,
    mobileTargetTopOffsetPx: 144,
    sample: 'unknown',
    titleKey: 'tour.catalogUnknown.title',
    bodyKey: 'tour.catalogUnknown.body',
  },
  {
    id: 'planner-grid',
    route: ROUTES.planner,
    targets: ['planner-grid'],
    preserveScroll: true,
    resetScroll: true,
    allowMobileScroll: true,
    titleKey: 'tour.plannerGrid.title',
    bodyKey: 'tour.plannerGrid.body',
  },
  {
    id: 'planner-mobile-add-button',
    route: ROUTES.planner,
    targets: ['planner-add'],
    viewport: 'mobile',
    preserveScroll: true,
    resetScroll: true,
    allowMobileScroll: true,
    targetTopOffsetPx: 96,
    titleKey: 'tour.plannerMobileAddButton.title',
    bodyKey: 'tour.plannerMobileAddButton.body',
  },
  {
    id: 'planner-add-mobile',
    route: ROUTES.planner,
    targets: ['planner-interested-card', 'planner-interested'],
    viewport: 'mobile',
    preserveScroll: true,
    titleKey: 'tour.plannerAddMobile.title',
    bodyKey: 'tour.plannerAddMobile.body',
  },
  {
    id: 'planner-add-desktop',
    route: ROUTES.planner,
    targets: ['planner-interested-card', 'planner-interested'],
    viewport: 'desktop',
    preserveScroll: true,
    titleKey: 'tour.plannerAddDesktop.title',
    bodyKey: 'tour.plannerAddDesktop.body',
  },
  {
    id: 'planner-progress',
    route: ROUTES.planner,
    targets: ['planner-progress'],
    preserveScroll: true,
    allowMobileScroll: true,
    titleKey: 'tour.plannerProgress.title',
    bodyKey: 'tour.plannerProgress.body',
  },
  {
    id: 'planner-export',
    route: ROUTES.planner,
    targets: ['planner-export'],
    preserveScroll: true,
    allowMobileScroll: true,
    titleKey: 'tour.plannerExport.title',
    bodyKey: 'tour.plannerExport.body',
  },
  {
    id: 'progress',
    route: ROUTES.overview,
    targets: ['overview-progress', 'overview-page'],
    allowMobileScroll: true,
    titleKey: 'tour.progress.title',
    bodyKey: 'tour.progress.body',
  },
  {
    id: 'reopen-guide',
    route: ROUTES.catalog,
    targets: ['reopen-tour'],
    preserveScroll: true,
    titleKey: 'tour.reopen.title',
    bodyKey: 'tour.reopen.body',
  },
]

function getRouteTitleKey(route: string | undefined): TranslationKey | null {
  switch (route) {
    case ROUTES.transcript:
      return 'nav.transcript'
    case ROUTES.catalog:
      return 'nav.catalog'
    case ROUTES.planner:
      return 'nav.planner'
    case ROUTES.overview:
      return 'nav.progress'
    default:
      return null
  }
}

function buildStepTitle(step: TourStepDefinition, t: (key: TranslationKey) => string): string {
  const title = t(step.titleKey)
  if (step.id === 'welcome' || step.id === 'reopen-guide') {
    return title
  }
  const routeTitleKey = getRouteTitleKey(step.route)
  return routeTitleKey ? `${t(routeTitleKey)} - ${title}` : title
}

export function buildTourSteps(t: (key: TranslationKey) => string): TourStep[] {
  return TOUR_STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    route: step.route,
    targets: step.targets,
    viewport: step.viewport,
    targetTopOffsetPx: step.targetTopOffsetPx,
    mobileTargetTopOffsetPx: step.mobileTargetTopOffsetPx,
    spotlightPaddingPx: step.spotlightPaddingPx,
    preserveScroll: step.preserveScroll,
    resetScroll: step.resetScroll,
    allowMobileScroll: step.allowMobileScroll,
    optional: step.optional,
    sample: step.sample,
    title: buildStepTitle(step, t),
    body: t(step.bodyKey),
  }))
}
