import { compareSemesterLabels, getRelativeSemesterLabel } from '../../planner/utils/semesterLabels.ts'

export interface SemesterBlock {
  label: string
  courseCount: number
  isEmpty: boolean
}

interface PlanCount {
  semesterLabel: string
  courseCount: number
}

// Builds the chronological list of semester blocks shown in the overview: every
// saved plan, the user's start semester, and at most one freshly added empty
// block. Empty = no courses planned yet.
export function buildSemesterBlocks(
  savedPlans: PlanCount[],
  startLabel: string | null | undefined,
  extraEmptyLabel: string | null,
): SemesterBlock[] {
  const countByLabel = new Map<string, number>()
  for (const plan of savedPlans) {
    countByLabel.set(plan.semesterLabel, plan.courseCount)
  }

  const labels = new Set<string>(countByLabel.keys())
  if (startLabel && startLabel.trim()) {
    labels.add(startLabel.trim())
  }
  if (extraEmptyLabel) {
    labels.add(extraEmptyLabel)
  }

  return [...labels].sort(compareSemesterLabels).map((label) => {
    const courseCount = countByLabel.get(label) ?? 0
    return { label, courseCount, isEmpty: courseCount === 0 }
  })
}

// Only one empty block may exist at a time, so the user fills a new semester
// before adding the next.
export function canAddEmptySemester(blocks: SemesterBlock[]): boolean {
  return !blocks.some((block) => block.isEmpty)
}

// The next empty block is the semester right after the latest existing block.
export function nextEmptySemesterLabel(blocks: SemesterBlock[], fallbackLabel: string): string {
  if (blocks.length === 0) {
    return fallbackLabel
  }
  const latestLabel = blocks[blocks.length - 1].label
  return getRelativeSemesterLabel(latestLabel, 1)
}
