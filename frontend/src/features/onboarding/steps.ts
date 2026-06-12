import { ROUTES } from '../routes'
import type { TourStep } from './types'

/**
 * The tour walks through the real screens and highlights live UI instead of
 * describing it. Steps without targets render as a centered card.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to StudyPlanner',
    body:
      'A one-minute tour through the real screens — made for Informatik at Uni Tübingen. Leave anytime; the ? button brings it back.',
  },
  {
    id: 'transcript',
    route: ROUTES.transcript,
    targets: ['transcript-upload', 'transcript-page'],
    title: 'Start with your transcript',
    body:
      'Drop your Transcript of Records (PDF from ALMA) here once — completed courses and progress come in automatically.',
  },
  {
    id: 'catalog-search',
    route: ROUTES.catalog,
    targets: ['catalog-search'],
    title: 'Every course, one search',
    body: 'All Informatics courses across semesters — just start typing.',
  },
  {
    id: 'catalog-filters',
    route: ROUTES.catalog,
    targets: ['catalog-filters'],
    title: 'Filter and sort',
    body: 'Weekday, exact time window, ECTS, degree areas — plus sorting.',
  },
  {
    id: 'catalog-card',
    route: ROUTES.catalog,
    targets: ['catalog-card'],
    title: 'One card, the essentials',
    body:
      'Type, areas, professor, ECTS, term. Tap the bookmark to keep a course for planning.',
  },
  {
    id: 'catalog-card-likely',
    route: ROUTES.catalog,
    targets: ['catalog-card-likely'],
    optional: true,
    title: 'Dashed border',
    body: 'This course ran last year — no data for the next term yet, but it will likely run again.',
  },
  {
    id: 'catalog-card-unknown',
    route: ROUTES.catalog,
    targets: ['catalog-card-unknown'],
    optional: true,
    title: 'Faded card',
    body: 'No sign this course returns. You can hide these via "Apply filter" in the filters.',
  },
  {
    id: 'planner-grid',
    route: ROUTES.planner,
    targets: ['planner-grid'],
    title: 'Your week',
    body: 'Courses sit at their real times, overlaps are highlighted, everything saves by itself. Tap a block for details.',
  },
  {
    id: 'planner-add',
    route: ROUTES.planner,
    targets: ['planner-interested', 'planner-add'],
    title: 'Add bookmarked courses',
    body: 'Your bookmarks wait here — tap for details and add, or drag into the week.',
  },
  {
    id: 'planner-progress',
    route: ROUTES.planner,
    targets: ['planner-progress'],
    title: 'See what it gets you',
    body: 'How this plan moves each area of your degree — live.',
  },
  {
    id: 'planner-export',
    route: ROUTES.planner,
    targets: ['planner-export'],
    title: 'Take it with you',
    body: 'Export the plan as a calendar file for Google, Apple, or Outlook.',
  },
  {
    id: 'overview',
    route: ROUTES.overview,
    targets: ['overview-progress', 'overview-page'],
    title: 'Track your degree',
    body:
      'ECTS per regulation area, your average grade, and what is still open. That is the whole flow — reopen this tour anytime via the ? button.',
  },
]
