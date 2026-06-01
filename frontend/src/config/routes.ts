export const ROUTES = {
  dashboard: '/',
  catalog: '/catalog',
  catalogDetail: '/catalog/:courseId',
  transcript: '/transcript',
  planner: '/planner',
  account: '/account',
} as const

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]

export function getCourseDetailRoute(courseId: string): string {
  return `/catalog/${courseId}`
}
