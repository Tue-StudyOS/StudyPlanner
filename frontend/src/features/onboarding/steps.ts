import {
  CatalogIcon,
  DashboardIcon,
  PlannerIcon,
  TranscriptIcon,
  WelcomeIcon,
} from './components/icons'
import type { OnboardingStep } from './types'

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    eyebrow: 'Welcome',
    title: 'Plan your Informatik degree in Tübingen',
    description:
      'StudyPlanner is built for computer science students at the University of Tübingen. It combines three things in one place:',
    bullets: [
      'The full Informatics course catalog across semesters, with hints on what will likely run next.',
      'Your real degree progress, mapped to the areas of your examination regulations (PO).',
      'A weekly semester planner that saves automatically and exports to your calendar.',
    ],
    Icon: WelcomeIcon,
  },
  {
    id: 'transcript',
    eyebrow: 'Step 1 · Transcript',
    title: 'Start with your completed courses',
    description:
      'Everything builds on what you have already passed, so bring in your history first on the Transcript page:',
    bullets: [
      'Upload your Transcript of Records (PDF from ALMA) — courses are imported and categorized automatically.',
      'Or add courses by hand if you prefer.',
      'You can adjust the credited area of any course afterwards.',
    ],
    Icon: TranscriptIcon,
  },
  {
    id: 'catalog',
    eyebrow: 'Step 2 · Catalog',
    title: 'Find courses worth taking',
    description:
      'The Catalog shows every Informatics course across semesters — not just the current one:',
    bullets: [
      '"Likely offered" marks courses that ran in the same season last year; grayed-out courses have no current data.',
      'Filter by area, ECTS, weekday, or an exact time window — and sort the results.',
      'Star anything interesting: starred courses become your building blocks in the planner.',
    ],
    Icon: CatalogIcon,
  },
  {
    id: 'planner',
    eyebrow: 'Step 3 · Planner',
    title: 'Build your week',
    description:
      'The Planner opens on the current semester and saves every change automatically:',
    bullets: [
      'Add starred courses from the side panel (or the + button on the phone) — overlaps are highlighted.',
      'Tap any course for details; remove it from the plan there.',
      'The strip on top shows how the plan moves your degree forward — export the result to your calendar as .ics.',
    ],
    Icon: PlannerIcon,
  },
  {
    id: 'overview',
    eyebrow: 'Step 4 · Overview',
    title: 'Keep an eye on your progress',
    description: 'The Overview page tracks your degree against the official regulations:',
    bullets: [
      'ECTS earned versus required, per regulation area.',
      'Your specialization focus and average grade.',
      'Open requirements also appear as a slim reminder while you browse the catalog.',
    ],
    Icon: DashboardIcon,
  },
  {
    id: 'finish',
    eyebrow: 'Ready',
    title: 'That is the whole flow',
    description:
      'Transcript in, star interesting courses, plan the semester — the app keeps progress and saving in the background. Reopen this guide anytime via the ? icon in the top bar.',
    Icon: WelcomeIcon,
  },
]
