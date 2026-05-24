import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type { ProgressSnapshot } from './types'

export async function fetchProgressSnapshot(token: string): Promise<ProgressSnapshot> {
  return await fetchJson<ProgressSnapshot>('/api/me/progress', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
}
