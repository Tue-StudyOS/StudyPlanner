import { Link } from 'react-router-dom'
import type { CourseTermType } from '../../courses'
import { SeasonSymbol } from '../../../shared/components/SeasonSymbol'
import { SEASON_SEMESTER_CARD_CLASS } from '../../../shared/components/seasonSymbolStyles.ts'
import {
  formatSemesterLabelDisplay,
  parseSemesterLabel,
  compareSemesterLabels,
  getCurrentSemesterLabel,
} from '../utils/semesterLabels'

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
        className={SEASON_SEMESTER_CARD_CLASS}
      />

      {showBadge ? (
        <span
          aria-hidden="true"
          className="absolute right-5 top-5 z-10 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_2px_var(--color-surface),0_0_8px_rgba(239,68,68,0.55)]"
        />
      ) : null}

      <span className="relative z-10 text-[15px] font-semibold tracking-[-0.01em] text-fg sm:text-[16px]">
        {formatSemesterLabelDisplay(semesterLabel)}
      </span>
      {isCurrentSemester ? (
        <span className="relative z-10 mt-1 text-[11.5px] font-medium text-primary">Current semester</span>
      ) : null}
    </Link>
  )
}
