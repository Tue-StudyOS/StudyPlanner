import { ApiError, createCsrfHeaders, fetchJson } from '../../shared/utils/api'
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
  hiddenSlotIds?: string[]
  manualSlots?: import('./types.ts').ManualPlannerSlot[]
  courseAssignments?: Record<string, string>
}

interface PlannerBalanceWarning {
  type: string
  courseId?: string
  courseTitle?: string
  message: string
}

interface PlannerBalanceSummaryArea {
  areaCode: string
  areaName: string
  creditedEcts: number
  plannedEcts: number
  capacityEcts: number | null
}

interface PlannerBalanceResult {
  assignments: Record<string, string>
  warnings: PlannerBalanceWarning[]
  unassignedCourseIds: string[]
  summary: PlannerBalanceSummaryArea[]
  strictSolutionFound: boolean
}

export async function fetchSemesterPlans(): Promise<SemesterPlanSummary[]> {
  const response = await fetchJson<SemesterPlansResponse>('/api/me/semester-plans')
  return response.semesterPlans
}

export async function fetchSemesterPlan(semesterLabel: string): Promise<SemesterPlan | null> {
  try {
    const response = await fetchJson<SemesterPlanResponse>(
      `/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`,
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
  csrfToken: string,
  semesterLabel: string,
  input: SaveSemesterPlanInput,
): Promise<SemesterPlan> {
  const response = await fetchJson<SemesterPlanResponse>(
    `/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...createCsrfHeaders(csrfToken),
      },
      body: JSON.stringify(input),
    },
  )
  return response.semesterPlan
}

export async function deleteSemesterPlan(csrfToken: string, semesterLabel: string): Promise<void> {
  await fetchJson<void>(`/api/me/semester-plans/${encodeURIComponent(semesterLabel)}`, {
    method: 'DELETE',
    headers: {
      ...createCsrfHeaders(csrfToken),
    },
  })
}

export async function balanceSemesterPlan(
  csrfToken: string,
  semesterLabel: string,
  input: {
    courseIds: string[]
    courseAssignments: Record<string, string>
  },
): Promise<PlannerBalanceResult> {
  return await fetchJson<PlannerBalanceResult>(
    `/api/me/semester-plans/${encodeURIComponent(semesterLabel)}/balance`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createCsrfHeaders(csrfToken),
      },
      body: JSON.stringify(input),
    },
  )
}
