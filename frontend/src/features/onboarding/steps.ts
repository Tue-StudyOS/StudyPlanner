import {
  CatalogIcon,
  DashboardIcon,
  PlannerIcon,
  TranscriptIcon,
  WelcomeIcon,
} from './components/icons'
import { ROUTES } from '../routes'
import type { OnboardingStep } from './types'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Getting started',
    title: 'Welcome to StudyPlanner',
    description:
      'Plan your degree from start to finish. This short guide walks you through the four core areas of the app. You can reopen it anytime via the ? icon in the top bar.',
    Icon: WelcomeIcon,
  },
  {
    id: 'transcript',
    eyebrow: 'Transcript',
    title: 'Bring in your completed courses',
    description: 'Head to the Transcript page to get your study history into the app. You have two options:',
    bullets: [
      'Upload your Transcript of Records (PDF) — completed courses are imported and categorized automatically, and you can adjust the category of any imported course by hand afterwards.',
      "Add courses manually — enter individual courses by hand if you don't have a PDF.",
    ],
    Icon: TranscriptIcon,
    route: ROUTES.transcript,
  },
  {
    id: 'dashboard',
    eyebrow: 'Dashboard',
    title: 'See your progress at a glance',
    description: 'The Dashboard gives you an overview of your studies so far:',
    bullets: [
      'ECTS earned versus the credits your program requires.',
      'Progress per category and study area, so you see where requirements are still open.',
      'Your specialization focus and overall regulation progress.',
      'A grade overview across your completed courses.',
    ],
    Icon: DashboardIcon,
    route: ROUTES.dashboard,
  },
  {
    id: 'catalog',
    eyebrow: 'Catalog',
    title: 'Discover and favorite courses',
    description:
      'Browse the Catalog to explore the full course offering. Star the courses you are interested in to add them to your favorites — they become the building blocks for planning your semester.',
    Icon: CatalogIcon,
    route: ROUTES.catalog,
  },
  {
    id: 'planner',
    eyebrow: 'Planner',
    title: 'Build your semester',
    description:
      'In the Planner, assemble upcoming semesters from your favorited courses. You get recommendations based on the category requirements of your study program, so each semester moves you toward your degree.',
    Icon: PlannerIcon,
    route: ROUTES.planner,
  },
]
