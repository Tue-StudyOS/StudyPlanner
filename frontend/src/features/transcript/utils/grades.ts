export const TRANSCRIPT_GRADE_VALUES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0] as const

export function formatOptionalTranscriptGrade(value: number | null): string {
  return value === null ? '' : String(value)
}

export function isValidTranscriptGrade(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 1 && value <= 4
    && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001)
}

export function truncateDegreeGrade(value: number): number {
  return Math.trunc((value + Number.EPSILON) * 10) / 10
}
