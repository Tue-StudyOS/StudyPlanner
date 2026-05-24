import { createAuthHeaders, fetchJson } from '../../shared/utils/api'

interface FavoritesResponse {
  favoriteCourseIds: string[]
  count: number
}

export async function fetchFavoriteCourseIds(token: string): Promise<string[]> {
  const response = await fetchJson<FavoritesResponse>('/api/me/favorites', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return response.favoriteCourseIds
}

export async function saveFavoriteCourseIds(
  token: string,
  favoriteCourseIds: string[],
): Promise<string[]> {
  const response = await fetchJson<FavoritesResponse>('/api/me/favorites', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify({ favoriteCourseIds }),
  })
  return response.favoriteCourseIds
}
