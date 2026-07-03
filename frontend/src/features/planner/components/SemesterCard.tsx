import { Link } from 'react-router-dom'
import type { CourseTermType } from '../../courses'
import { SeasonSymbol } from '../../../shared/components/SeasonSymbol'
import { SEASON_WATERMARK_CLASS } from '../../../shared/components/seasonSymbolStyles.ts'
import { formatSemesterLabelShort, parseSemesterLabel, compareSemesterLabels, getCurrentSemesterLabel } from '../utils/semesterLabels'

interface SemesterCardProps {
  semesterLabel: string
  to: string
  showBadge?: boolean
}

function seasonForLabel(semesterLabel: string): CourseTermType | undefined {
  const parsed = parseSemesterLabel(semesterLabel)
  if (!parsed) {
    return undefined
  }
  return parsed.term === 'SS' ? 'summer' : 'winter'
}

/**
 * Hub tile for one semester: equal-size card with season watermark and optional
 * badge when new courses were added to that semester's plan.
 */
export function SemesterCard({ semesterLabel, to, showBadge = false }: SemesterCardProps) {
  const isCurrentSemester = compareSemesterLabels(semesterLabel, getCurrentSemesterLabel()) === 0

  return (
    <Link
      to={to}
      className={`group relative flex min-h-[8.5rem] w-full min-w-0 flex-col justify-end overflow-hidden rounded-[14px] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isCurrentSemester
          ? 'border-primary ring-1 ring-primary/35 bg-surface'
          : 'border-border bg-surface hover:border-primary/30'
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"
      >
        <SeasonSymbol termType={seasonForLabel(semesterLabel)} className={SEASON_WATERMARK_CLASS} />
      </div>

      {showBadge ? (
        <span
          aria-hidden="true"
          className="absolute right-3 top-3 z-10 h-2.5 w-2.5 rounded-full bg-danger shadow-[0_0_0_2px_var(--color-surface)]"
        />
      ) : null}

      <span className="relative z-10 text-[16px] font-semibold tracking-[-0.01em] text-fg">
        {formatSemesterLabelShort(semesterLabel)}
      </span>
      {isCurrentSemester ? (
        <span className="relative z-10 mt-1 text-[11.5px] font-medium text-primary">Current semester</span>
      ) : (
        <span className="relative z-10 mt-3 flex items-center justify-end">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface/80 text-[13px] text-primary transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      )}
    </Link>
  )
}
