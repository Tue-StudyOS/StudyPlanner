export const ROUTES = {
  catalog: '/catalog',
  planner: '/semester',
  // '/catalog/:courseId' also exists as a deep link; it is wired as a child
  // route in App.tsx and opens the detail drawer over the catalog.
  transcript: '/transcript',
  account: '/account',
  log: '/log',
  reviewRules: '/review-rules',
  semesterDetail: '/semester/:label',
} as const

// The planner hub used to live at '/'; '/' now opens the catalog instead.
export const LEGACY_PLANNER_ROUTE = '/planner'

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]

export const LEGACY_CATALOG_ROUTE = '/katalog'

export function semesterPath(label: string): string {
  return `/semester/${encodeURIComponent(label)}`
}
