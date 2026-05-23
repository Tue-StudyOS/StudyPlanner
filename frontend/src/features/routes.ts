export const ROUTES = {
  dashboard: '/',
  catalog: '/catalog',
  catalogDetail: '/catalog/:courseId',
  favorites: '/favorites',
  transcript: '/transcript',
} as const

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]

export function getCourseDetailRoute(courseId: string): string {
  return `/catalog/${courseId}`
}
