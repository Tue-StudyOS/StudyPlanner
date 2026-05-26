export const TRANSCRIPT_GRADE_VALUES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0] as const

const TRANSCRIPT_GRADE_TOLERANCE = 0.0001

export function formatOptionalTranscriptGrade(value: number | null): string {
  return value === null ? '' : value.toFixed(1)
}

export function isValidTranscriptGrade(value: number | null): boolean {
  if (value === null) {
    return true
  }
  return TRANSCRIPT_GRADE_VALUES.some((allowedGrade) => Math.abs(allowedGrade - value) < TRANSCRIPT_GRADE_TOLERANCE)
}
