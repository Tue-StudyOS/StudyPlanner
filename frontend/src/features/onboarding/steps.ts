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
    titleKey: 'tour.transcript.title',
    bodyKey: 'tour.transcript.body',
  },
  {
    id: 'catalog-search',
    route: ROUTES.catalog,
    targets: ['catalog-search'],
    titleKey: 'tour.catalogSearch.title',
    bodyKey: 'tour.catalogSearch.body',
  },
  {
    id: 'catalog-filters',
    route: ROUTES.catalog,
    targets: ['catalog-filters'],
    titleKey: 'tour.catalogFilters.title',
    bodyKey: 'tour.catalogFilters.body',
  },
  {
    id: 'catalog-card',
    route: ROUTES.catalog,
    targets: ['catalog-card'],
    titleKey: 'tour.catalogCard.title',
    bodyKey: 'tour.catalogCard.body',
  },
  {
    id: 'catalog-card-likely',
    route: ROUTES.catalog,
    targets: ['catalog-card-likely'],
    optional: true,
    titleKey: 'tour.catalogLikely.title',
    bodyKey: 'tour.catalogLikely.body',
  },
  {
    id: 'catalog-card-unknown',
    route: ROUTES.catalog,
    targets: ['catalog-card-unknown'],
    optional: true,
    titleKey: 'tour.catalogUnknown.title',
    bodyKey: 'tour.catalogUnknown.body',
  },
  {
    id: 'planner-grid',
    route: ROUTES.planner,
    targets: ['planner-grid'],
    titleKey: 'tour.plannerGrid.title',
    bodyKey: 'tour.plannerGrid.body',
  },
  {
    id: 'planner-add',
    route: ROUTES.planner,
    targets: ['planner-interested', 'planner-add'],
    titleKey: 'tour.plannerAdd.title',
    bodyKey: 'tour.plannerAdd.body',
  },
  {
    id: 'planner-progress',
    route: ROUTES.planner,
    targets: ['planner-progress'],
    titleKey: 'tour.plannerProgress.title',
    bodyKey: 'tour.plannerProgress.body',
  },
  {
    id: 'planner-export',
    route: ROUTES.planner,
    targets: ['planner-export'],
    titleKey: 'tour.plannerExport.title',
    bodyKey: 'tour.plannerExport.body',
  },
  {
    id: 'progress',
    route: ROUTES.overview,
    targets: ['overview-progress', 'overview-page'],
    titleKey: 'tour.progress.title',
    bodyKey: 'tour.progress.body',
  },
  {
    id: 'reopen-guide',
    route: ROUTES.catalog,
    targets: ['reopen-tour'],
    titleKey: 'tour.reopen.title',
    bodyKey: 'tour.reopen.body',
  },
]

export function buildTourSteps(t: (key: TranslationKey) => string): TourStep[] {
  return TOUR_STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    route: step.route,
    targets: step.targets,
    optional: step.optional,
    title: t(step.titleKey),
    body: t(step.bodyKey),
  }))
}
