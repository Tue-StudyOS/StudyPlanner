import type { CourseTermType } from '../../courses'
import { SeasonSymbol } from '../../../shared/components/SeasonSymbol'
import { formatSemesterLabelShort, parseSemesterLabel } from '../utils/semesterLabels'

interface SemesterCardProps {
  semesterLabel: string
  courseCount: number
  isActive: boolean
  countLabel: (count: number) => string
  onSelect: (semesterLabel: string) => void
}

function seasonForLabel(semesterLabel: string): CourseTermType | undefined {
  const parsed = parseSemesterLabel(semesterLabel)
  if (!parsed) {
    return undefined
  }
  return parsed.term === 'SS' ? 'summer' : 'winter'
}

/**
 * A single semester in the planner's semester switcher: shows the term season
 * glyph, the short label (e.g. "SS 26"), and how many courses that semester
 * holds. Replaces the former dropdown so every semester since the study start
 * is visible at a glance.
 */
export function SemesterCard({
  semesterLabel,
  courseCount,
  isActive,
  countLabel,
  onSelect,
}: SemesterCardProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={() => onSelect(semesterLabel)}
      className={`group relative flex min-w-0 shrink-0 flex-col overflow-hidden rounded-[10px] border px-3.5 py-3 text-left transition-colors ${
        isActive
          ? 'border-primary ring-1 ring-primary/40 bg-surface'
          : 'border-border bg-surface hover:border-primary/30'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[10px]"
      >
        <SeasonSymbol
          termType={seasonForLabel(semesterLabel)}
          className="absolute -right-2 top-1/2 aspect-square h-[80%] w-auto -translate-y-1/2 opacity-25 dark:opacity-20"
        />
      </div>
      <span className="relative text-[13px] font-semibold text-fg">
        {formatSemesterLabelShort(semesterLabel)}
      </span>
      <span className="relative mt-0.5 text-[11.5px] text-fg-muted">
        {countLabel(courseCount)}
      </span>
    </button>
  )
}
