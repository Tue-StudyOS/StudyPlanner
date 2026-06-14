export const ROUTES = {
  planner: '/',
  catalog: '/catalog',
  catalogDetail: '/catalog/:courseId',
  overview: '/overview',
  transcript: '/transcript',
  account: '/account',
} as const

// The planner used to live here; old links keep working via a redirect.
export const LEGACY_PLANNER_ROUTE = '/planner'

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]
