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
      'A one-minute tour through the real app — made for Informatik at Uni Tübingen. We will hop across the screens and point at the things that matter. You can leave anytime and reopen the tour via the ? button.',
  },
  {
    id: 'transcript',
    route: ROUTES.transcript,
    targets: ['transcript-page'],
    title: 'Start with your transcript',
    body:
      'Upload your Transcript of Records (the PDF from ALMA) here once — your completed courses and degree progress come in automatically. You can also add courses by hand.',
  },
  {
    id: 'catalog-search',
    route: ROUTES.catalog,
    targets: ['catalog-search'],
    title: 'Every course, one search',
    body:
      'The catalog covers all Informatics courses across semesters — not just the current one. Just start typing.',
  },
  {
    id: 'catalog-filters',
    route: ROUTES.catalog,
    targets: ['catalog-filters'],
    title: 'Filter and sort',
    body:
      'Need a free Friday? Open the filters for weekday, exact time window, ECTS, and degree areas — and sort the results.',
  },
  {
    id: 'catalog-card',
    route: ROUTES.catalog,
    targets: ['catalog-card'],
    title: 'Read a card at a glance',
    body:
      'Type, areas, professor, ECTS, and the term a course runs in. A dashed border means the course ran last year and will likely run again — a faded card means there is no current sign it returns. Tap the bookmark to keep a course for planning.',
  },
  {
    id: 'planner-grid',
    route: ROUTES.planner,
    targets: ['planner-grid'],
    title: 'Your week',
    body:
      'Added courses appear at their real times, overlaps are highlighted, and every change saves by itself — there is no save button. Tap any block for details.',
  },
  {
    id: 'planner-add',
    route: ROUTES.planner,
    targets: ['planner-interested', 'planner-add'],
    title: 'Add bookmarked courses',
    body:
      'Your bookmarked courses wait here. Tap one for details and add it to the plan — or drag it straight into the week.',
  },
  {
    id: 'planner-progress',
    route: ROUTES.planner,
    targets: ['planner-progress'],
    title: 'See what it gets you',
    body:
      'This line shows how the current plan moves each area of your degree forward — before you commit to anything.',
  },
  {
    id: 'planner-export',
    route: ROUTES.planner,
    targets: ['planner-export'],
    title: 'Take it with you',
    body: 'Export the finished plan as a calendar file (.ics) for Google, Apple, or Outlook.',
  },
  {
    id: 'overview',
    route: ROUTES.overview,
    targets: ['overview-progress', 'overview-page'],
    title: 'Track your degree',
    body:
      'The Overview shows your ECTS per regulation area, your average grade, and what is still open — the same open areas follow you into the catalog as a slim reminder.',
  },
  {
    id: 'finish',
    title: 'That is the whole flow',
    body:
      'Transcript in, bookmark courses, plan the week — saving and progress happen in the background. Reopen this tour anytime via the ? button in the top bar.',
  },
]
