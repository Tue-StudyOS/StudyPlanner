import { ApiError, createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type { SemesterPlan, SemesterPlanSummary } from './types'

interface SemesterPlansResponse {
  semesterPlans: SemesterPlanSummary[]
}

interface SemesterPlanResponse {
  semesterPlan: SemesterPlan
}

interface SaveSemesterPlanInput {
  title?: string | null
  notes?: string | null
  courseIds: string[]
  courseAssignments?: Record<string, string>
}

export async function fetchSemesterPlans(token: string): Promise<SemesterPlanSummary[]> {
  const response = await fetchJson<SemesterPlansResponse>('/api/me/semester-plans', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return response.semesterPlans
}

export async function fetchSemesterPlan(
  token: string,
  semesterLabel: string,
): Promise<SemesterPlan | null> {
  try {
    const response = await fetchJson<SemesterPlanResponse>(
      `/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`,
      {
        headers: {
          ...createAuthHeaders(token),
        },
      },
    )
    return response.semesterPlan
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function saveSemesterPlan(
  token: string,
  semesterLabel: string,
  input: SaveSemesterPlanInput,
): Promise<SemesterPlan> {
  const response = await fetchJson<SemesterPlanResponse>(
    `/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createAuthHeaders(token),
      },
      body: JSON.stringify(input),
    },
  )
  return response.semesterPlan
}

export async function deleteSemesterPlan(token: string, semesterLabel: string): Promise<void> {
  await fetchJson<void>(`/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`, {
    method: 'DELETE',
    headers: {
      ...createAuthHeaders(token),
    },
  })
}
