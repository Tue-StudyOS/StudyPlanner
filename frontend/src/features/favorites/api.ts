import { createCsrfHeaders, fetchJson } from '../../shared/utils/api.ts'

export interface FavoritesResponse {
  semesterLabel: string
  favoriteCourseIds: string[]
  favoriteCourseGroups: string[][]
  count: number
}

export async function fetchFavoriteCourseIds(semesterLabel: string): Promise<FavoritesResponse> {
  return fetchJson<FavoritesResponse>(
    `/api/me/favorites?semesterLabel=${encodeURIComponent(semesterLabel)}`,
  )
}

export async function saveFavoriteCourseIds(
  csrfToken: string,
  semesterLabel: string,
  favoriteCourseIds: string[],
): Promise<FavoritesResponse> {
  return fetchJson<FavoritesResponse>('/api/me/favorites', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...createCsrfHeaders(csrfToken),
    },
    body: JSON.stringify({ semesterLabel, favoriteCourseIds }),
  })
}
