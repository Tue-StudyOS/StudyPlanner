import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type { IntermediateExamStatus, ProgressSnapshot, ProgressSummary } from './types'

type ProgressSnapshotResponse = Omit<Partial<ProgressSnapshot>, 'summary'> & {
  summary?: Partial<ProgressSummary>
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeProgressSnapshot(snapshot: ProgressSnapshotResponse): ProgressSnapshot {
  const summary = snapshot.summary ?? {}
  return {
    summary: {
      totalEcts: toNumber(summary.totalEcts, 0),
      requiredEcts: toNumber(summary.requiredEcts, 120),
      progressPercentage: toNumber(summary.progressPercentage, 0),
      averageGrade:
        typeof summary.averageGrade === 'number' && Number.isFinite(summary.averageGrade)
          ? summary.averageGrade
          : null,
    },
    masterCategoryProgress: Array.isArray(snapshot.masterCategoryProgress)
      ? snapshot.masterCategoryProgress
      : [],
    regulationProgress: Array.isArray(snapshot.regulationProgress)
      ? snapshot.regulationProgress
      : [],
    visualizationCategories: Array.isArray(snapshot.visualizationCategories)
      ? snapshot.visualizationCategories
      : [],
    profileName:
      typeof snapshot.profileName === 'string' && snapshot.profileName.trim().length > 0
        ? snapshot.profileName
        : '',
    unmappedCompletedCourses: Array.isArray(snapshot.unmappedCompletedCourses)
      ? snapshot.unmappedCompletedCourses
      : [],
    intermediateExam:
      snapshot.intermediateExam !== undefined
        ? (snapshot.intermediateExam as IntermediateExamStatus | null)
        : null,
  }
}

export async function fetchProgressSnapshot(token: string): Promise<ProgressSnapshot> {
  const response = await fetchJson<ProgressSnapshotResponse>('/api/me/progress', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
  return normalizeProgressSnapshot(response)
}
