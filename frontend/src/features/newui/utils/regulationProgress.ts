/** Completed share of an area, clamped to 0–100 (earned may exceed required). */
export function areaProgressPercent(earnedEcts: number, requiredEcts: number): number {
  if (requiredEcts <= 0) {
    return 0
  }
  return Math.min(100, Math.round((earnedEcts / requiredEcts) * 100))
}
