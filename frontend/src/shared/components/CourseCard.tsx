import type { ReactNode } from 'react'
import type { Course } from '../../features/courses'
import { CatBadge } from './CatBadge'
import { FavStar } from './FavStar'
import { ClockIcon, PinIcon, UserIcon } from './icons'

interface CourseCardProps {
  course: Course
  isFavorite: boolean
  onToggleFavorite: () => void
}

function TypePill({ label }: { label: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-pill-border bg-pill-bg px-2.5 py-0.75 text-[11px] font-medium text-pill-text">
      {label}
    </span>
  )
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

export function CourseCard({ course, isFavorite, onToggleFavorite }: CourseCardProps) {
  const slot = course.schedule.at(0)

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-border bg-surface px-4.5 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2">
        <TypePill label={course.types.join(' + ')} />
        <div className="flex flex-1 flex-wrap gap-0.75">
          {course.masterCats.map((cat) => (
            <CatBadge key={cat} cat={cat} />
          ))}
        </div>
        <FavStar active={isFavorite} onToggle={onToggleFavorite} />
      </div>

      <div>
        <div className="mb-0.5 text-[15.5px] font-semibold leading-tight text-fg">{course.title}</div>
        <div className="text-[12px] text-fg-muted">{course.number}</div>
      </div>

      <div className="flex flex-col gap-1.5 border-t border-border-light pt-1">
        <InfoRow icon={<UserIcon />} text={plainLecturerName(course.lecturer)} />
        {slot && <InfoRow icon={<ClockIcon />} text={`${slot.day}, ${slot.time}`} />}
        {slot && <InfoRow icon={<PinIcon />} text={slot.room} />}
      </div>

      <div className="flex items-center border-t border-border-light pt-1.5">
        <span className="text-[13px] font-bold text-fg">
          {course.ects} <span className="text-[11px] font-normal text-fg-muted">ECTS</span>
        </span>
      </div>
    </div>
  )
}
