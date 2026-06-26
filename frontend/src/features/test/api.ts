import { createAuthHeaders, fetchJson } from '../../shared/utils/api'

export interface AnrechnungChange {
  completedCourseId: string
  fromAreaCode: string | null
  toAreaCode: string
  title: string | null
  fromAreaName: string | null
  toAreaName: string | null
}

export interface AnrechnungOptimization {
  hasImprovement: boolean
  gainedAreas: number
  gainedEcts: number
  before: { coveredAreas: number; creditedEcts: number }
  after: { coveredAreas: number; creditedEcts: number }
  changes: AnrechnungChange[]
  assignment: Record<string, string>
}

export async function fetchAnrechnungOptimization(token: string): Promise<AnrechnungOptimization> {
  return await fetchJson<AnrechnungOptimization>('/api/me/anrechnung/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: '{}',
  })
}
