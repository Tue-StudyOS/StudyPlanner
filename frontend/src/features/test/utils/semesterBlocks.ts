import { compareSemesterLabels, getRelativeSemesterLabel } from '../../planner/utils/semesterLabels.ts'

export interface SemesterBlock {
  label: string
  courseCount: number
  isEmpty: boolean
  isHistorical: boolean
}

interface PlanCount {
  semesterLabel: string
  courseCount: number
}

type HistoricalSemesterInput = string | PlanCount

function normalizeHistoricalSemester(input: HistoricalSemesterInput): PlanCount | null {
  if (typeof input === 'string') {
    const semesterLabel = input.trim()
    return semesterLabel ? { semesterLabel, courseCount: 0 } : null
  }

  const semesterLabel = input.semesterLabel.trim()
  return semesterLabel ? { semesterLabel, courseCount: input.courseCount } : null
}

// Builds the chronological list of semester blocks shown in the overview: every
// saved plan, the user's start semester, semesters derived from completed courses
// (historical), and at most one freshly added empty block.
export function buildSemesterBlocks(
  savedPlans: PlanCount[],
  startLabel: string | null | undefined,
  extraEmptyLabel: string | null,
  historicalSemesters: HistoricalSemesterInput[] = [],
): SemesterBlock[] {
  const savedCountByLabel = new Map<string, number>()
  for (const plan of savedPlans) {
    savedCountByLabel.set(plan.semesterLabel, plan.courseCount)
  }

  const historicalCountByLabel = new Map<string, number>()
  for (const rawHistoricalSemester of historicalSemesters) {
    const historicalSemester = normalizeHistoricalSemester(rawHistoricalSemester)
    if (!historicalSemester) {
      continue
    }
    historicalCountByLabel.set(
      historicalSemester.semesterLabel,
      (historicalCountByLabel.get(historicalSemester.semesterLabel) ?? 0) + historicalSemester.courseCount,
    )
  }

  const labels = new Set<string>(savedCountByLabel.keys())
  if (startLabel && startLabel.trim()) {
    labels.add(startLabel.trim())
  }
  if (extraEmptyLabel) {
    labels.add(extraEmptyLabel)
  }
  for (const label of historicalCountByLabel.keys()) {
    labels.add(label)
  }

  return [...labels].sort(compareSemesterLabels).map((label) => {
    const savedCourseCount = savedCountByLabel.get(label)
    const historicalCourseCount = historicalCountByLabel.get(label) ?? 0
    const courseCount = savedCourseCount ?? historicalCourseCount
    const isHistorical = historicalCountByLabel.has(label) && (savedCourseCount === undefined || savedCourseCount === 0)
    return {
      label,
      courseCount,
      isEmpty: courseCount === 0 && !isHistorical,
      isHistorical,
    }
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
