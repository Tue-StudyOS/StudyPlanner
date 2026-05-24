import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Course } from '../../features/courses'
import { getCourseDetailRoute } from '../../features/routes'
import { CatBadge } from './CatBadge'
import { FavStar } from './FavStar'
import { ClockIcon, PinIcon, UserIcon } from './icons'

interface CourseCardProps {
  course: Course
  isFavorite: boolean
  favoriteDisabled?: boolean
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
  favoriteDisabled = false,
  onToggleFavorite,
}: CourseCardProps) {
  const slot = course.schedule.at(0)
  const courseDetailRoute = getCourseDetailRoute(course.id)

  return (
    <div className="group relative flex cursor-pointer flex-col gap-3 rounded-[10px] border border-border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:border-primary/30">
      <Link
        to={courseDetailRoute}
        aria-label={`Open ${course.title}`}
        className="absolute inset-0 rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      />

      <div className="relative z-10 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 pointer-events-none">
          <TypePill label={course.types.join(' + ') || 'Course'} />
          <div className="flex flex-1 flex-wrap gap-0.75">
            {course.masterCats.map((cat) => (
              <CatBadge key={cat} cat={cat} />
            ))}
          </div>
        </div>
        <div className="relative z-20">
          <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
        </div>
      </div>

      <div className="pointer-events-none relative z-10">
        <h3 className="mb-0.5 text-[15.5px] font-semibold leading-tight text-fg transition-colors group-hover:text-primary">
          {course.title}
        </h3>
        <div className="text-[12px] text-fg-muted">{course.number}</div>
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-1.5 border-t border-border-light pt-1">
        <InfoRow icon={<UserIcon />} text={plainLecturerName(course.lecturer || 'TBA')} />
        {slot && <InfoRow icon={<ClockIcon />} text={`${slot.day}, ${slot.time}`} />}
        {slot && <InfoRow icon={<PinIcon />} text={slot.room} />}
      </div>

      <div className="pointer-events-none relative z-10 flex items-center border-t border-border-light pt-1.5">
        <span className="text-[13px] font-bold text-fg">
          {formatEcts(course.ects)} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
        </span>
      </div>
    </div>
  )
}
