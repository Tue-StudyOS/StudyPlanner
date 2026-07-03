import { Link } from 'react-router-dom'
import type { CourseTermType } from '../../courses'
import { SeasonSymbol } from '../../../shared/components/SeasonSymbol'
import { SEASON_ICON_CLASS } from '../../../shared/components/seasonSymbolStyles.ts'
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

export function SemesterCard({ semesterLabel, to, showBadge = false }: SemesterCardProps) {
  const isCurrentSemester = compareSemesterLabels(semesterLabel, getCurrentSemesterLabel()) === 0

  return (
    <Link
      to={to}
      className={`relative flex min-h-[8.5rem] w-full min-w-0 flex-col justify-end overflow-hidden rounded-[14px] border px-4 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
        isCurrentSemester
          ? 'border-primary ring-1 ring-primary/35 bg-surface'
          : 'border-border bg-surface hover:border-primary/30'
      }`}
    >
      <SeasonSymbol
        termType={seasonForLabel(semesterLabel)}
        className={`absolute right-4 top-4 ${SEASON_ICON_CLASS}`}
      />

      {showBadge ? (
        <span
          aria-hidden="true"
          className="absolute right-4 top-4 z-10 h-2.5 w-2.5 translate-x-3 -translate-y-0.5 rounded-full bg-danger shadow-[0_0_0_2px_var(--color-surface)]"
        />
      ) : null}

      <span className="relative z-10 text-[16px] font-semibold tracking-[-0.01em] text-fg">
        {formatSemesterLabelShort(semesterLabel)}
      </span>
      {isCurrentSemester ? (
        <span className="relative z-10 mt-1 text-[11.5px] font-medium text-primary">Current semester</span>
      ) : null}
    </Link>
  )
}
