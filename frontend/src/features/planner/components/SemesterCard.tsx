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
import { useSemesterCardBadge } from '../utils/semesterTabBadge.ts'
import type { SemesterCardStats } from '../utils/semesterCardStats.ts'

interface SemesterCardProps {
  semesterLabel: string
  to: string
  stats?: SemesterCardStats
  tourAnchorId?: string
}

function seasonForLabel(semesterLabel: string): CourseTermType | undefined {
  const parsed = parseSemesterLabel(semesterLabel)
  if (!parsed) {
    return undefined
  }
  return parsed.term === 'SS' ? 'summer' : 'winter'
}

export function SemesterCard({ semesterLabel, to, stats, tourAnchorId }: SemesterCardProps) {
  const isCurrentSemester = compareSemesterLabels(semesterLabel, getCurrentSemesterLabel()) === 0
  const hasBadge = useSemesterCardBadge()
  const showNotificationBadge = isCurrentSemester && hasBadge

  return (
    <Link
      to={to}
      data-tour={tourAnchorId}
      className={`relative flex min-h-[8.5rem] w-full min-w-0 flex-col justify-end overflow-hidden rounded-[14px] border px-4 py-4 text-left opacity-90 transition-all hover:-translate-y-0.5 hover:opacity-100 hover:shadow-md ${
        isCurrentSemester
          ? 'border-primary ring-1 ring-primary/35 bg-surface/90'
          : 'border-border bg-surface/80 hover:border-primary/30'
      }`}
    >
      <SeasonGlyphWatermark
        termType={seasonForLabel(semesterLabel)}
        variant="semester"
        overlay={
          showNotificationBadge ? (
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
      {stats ? (
        <div className="relative z-10 mt-2 space-y-1">
          <div className="text-[12px] text-fg-muted">
            <span className="font-semibold text-fg">{stats.totalEcts}</span> ECTS
            {' · '}
            {stats.courseCount} course{stats.courseCount !== 1 ? 's' : ''}
          </div>
          {stats.areaStats.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {stats.areaStats.slice(0, 3).map((area) => (
                <span
                  key={area.areaCode}
                  className="inline-block max-w-full truncate rounded-full border border-border bg-surface/80 px-2 py-0.5 text-[10px] font-medium text-fg-mid"
                >
                  {area.label}: {area.ects}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {isCurrentSemester ? (
        <span className="relative z-10 mt-1 text-[11.5px] font-medium text-primary">Current semester</span>
      ) : null}
    </Link>
  )
}
