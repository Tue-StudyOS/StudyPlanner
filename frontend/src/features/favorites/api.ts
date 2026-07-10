import { createCsrfHeaders, fetchJson } from '../../shared/utils/api'

interface FavoritesResponse {
  favoriteCourseIds: string[]
  count: number
}

export async function fetchFavoriteCourseIds(): Promise<string[]> {
  const response = await fetchJson<FavoritesResponse>('/api/me/favorites')
  return response.favoriteCourseIds
}

export async function saveFavoriteCourseIds(
  csrfToken: string,
  favoriteCourseIds: string[],
): Promise<string[]> {
  const response = await fetchJson<FavoritesResponse>('/api/me/favorites', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createCsrfHeaders(csrfToken),
    },
    body: JSON.stringify({ favoriteCourseIds }),
  })
  return response.favoriteCourseIds
}
