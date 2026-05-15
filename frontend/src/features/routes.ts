export const ROUTES = {
  dashboard:  '/',
  catalog:    '/catalog',
  favorites:  '/favorites',
  transcript: '/transcript',
} as const

export type RoutePath = typeof ROUTES[keyof typeof ROUTES]
