import type { ReactNode } from 'react'
import type { Course } from '../../features/courses'
import { CatBadge } from './CatBadge'
import { CompletedBadge } from './CompletedBadge'
import { FavStar } from './FavStar'
import { ClockIcon, PinIcon, UserIcon } from './icons'

interface CourseCardProps {
  course: Course
  isFavorite: boolean
  isActive?: boolean
  isCompleted?: boolean
  favoriteDisabled?: boolean
  onSelect: () => void
  onToggleFavorite: () => void
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
}

function formatEcts(ects: number | null): string {
  if (ects === null) {
    return '–'
  }
  return Number.isInteger(ects) ? String(ects) : ects.toFixed(1)
}

function InfoRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-[12.5px] text-fg-mid">
      <span className="text-fg-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
    </div>
  )
}

function plainLecturerName(lecturer: string): string {
  return lecturer.replace(/Prof\. Dr\. |Prof\. |Dr\. /g, '')
}

export function CourseCard({
  course,
  isFavorite,
  isActive = false,
  isCompleted = false,
  favoriteDisabled = false,
  onSelect,
  onToggleFavorite,
}: CourseCardProps) {
  const slot = course.schedule.at(0)
  const borderClasses = isActive
    ? 'border-primary ring-1 ring-primary/40'
    : 'border-border hover:border-primary/30'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect()
        }
      }}
      aria-label={`Kursdetails öffnen: ${course.title}`}
      aria-pressed={isActive}
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-[10px] border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${borderClasses}`}
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TypePill label={course.types.join(' + ') || 'Course'} />
          <div className="flex flex-1 flex-wrap gap-0.75">
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
          </div>
        </div>
        <div onClick={(event) => event.stopPropagation()}>
          <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
        </div>
      </div>

      <div>
        <h3 className="mb-0.5 text-[15.5px] font-semibold leading-tight text-fg transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <div className="text-[12px] text-fg-muted">{course.number}</div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border-light pt-1">
        <InfoRow icon={<UserIcon />} text={plainLecturerName(course.lecturer || 'TBA')} />
        {slot && <InfoRow icon={<ClockIcon />} text={`${slot.day}, ${slot.time}`} />}
        {slot && <InfoRow icon={<PinIcon />} text={slot.room} />}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border-light pt-1.5">
        <span className="text-[13px] font-bold text-fg">
          {formatEcts(course.ects)} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
        </span>
        {isCompleted ? <CompletedBadge /> : null}
      </div>
    </div>
  )
}
