import { Link } from 'react-router-dom'
import type { CourseTermType } from '../../courses'
import { SeasonGlyphWatermark } from '../../../shared/components/SeasonGlyphWatermark.tsx'
import {
  SEASON_SEMESTER_BADGE_DOT_CLASS,
  SEASON_SEMESTER_BADGE_GLOW_CLASS,
} from '../../../shared/components/seasonSymbolStyles.ts'
import {
  formatSemesterLabelDisplay,
  parseSemesterLabel,
  compareSemesterLabels,
  getCurrentSemesterLabel,
} from '../utils/semesterLabels'

interface SemesterCardProps {
  semesterLabel: string
  to: string
}

function seasonForLabel(semesterLabel: string): CourseTermType | undefined {
  const parsed = parseSemesterLabel(semesterLabel)
  if (!parsed) {
    return undefined
  }
  return parsed.term === 'SS' ? 'summer' : 'winter'
}

export function SemesterCard({ semesterLabel, to }: SemesterCardProps) {
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
      <SeasonGlyphWatermark
        termType={seasonForLabel(semesterLabel)}
        variant="semester"
        overlay={
          isCurrentSemester ? (
            <span aria-hidden="true" className="relative flex h-3 w-3 items-center justify-center pointer-events-none">
              <span className={SEASON_SEMESTER_BADGE_GLOW_CLASS} />
              <span className={SEASON_SEMESTER_BADGE_DOT_CLASS} />
            </span>
          ) : undefined
        }
      />

      <span className="relative z-10 text-[15px] font-semibold tracking-[-0.01em] text-fg sm:text-[16px]">
        {formatSemesterLabelDisplay(semesterLabel)}
      </span>
      {isCurrentSemester ? (
        <span className="relative z-10 mt-1 text-[11.5px] font-medium text-primary">Current semester</span>
      ) : null}
    </Link>
  )
}
