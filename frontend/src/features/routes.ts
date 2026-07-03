export const ROUTES = {
  catalog: '/catalog',
  planner: '/semester',
  // '/catalog/:courseId' also exists as a deep link; it is wired as a child
  // route in App.tsx and opens the detail drawer over the catalog.
  overview: '/overview',
  transcript: '/transcript',
  account: '/account',
  log: '/log',
  semesterDetail: '/semester/:label',
} as const

// The planner hub used to live at '/'; '/' now opens the catalog instead.
export const LEGACY_PLANNER_ROUTE = '/planner'

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]

// Routes for the simplified, progressive "/test" surface. It runs in parallel to
// the main app and shares the same backend/data; only the navigation shell differs.
export const TEST_ROUTES = {
  root: '/test',
  catalog: '/test/catalog',
  personal: '/test/personal',
  progress: '/test/personal/progress',
  semesters: '/test/personal/semesters',
  semesterDetail: '/test/personal/semesters/:label',
  semesterPlan: '/test/personal/semesters/:label/plan',
  semesterEditor: '/test/personal/semesters/:label/editor',
} as const

export function testSemesterPath(label: string, suffix: '' | '/plan' | '/editor' = ''): string {
  return `${TEST_ROUTES.semesters}/${encodeURIComponent(label)}${suffix}`
}

export const LEGACY_CATALOG_ROUTE = '/katalog'

export function semesterPath(label: string): string {
  return `/semester/${encodeURIComponent(label)}`
}
