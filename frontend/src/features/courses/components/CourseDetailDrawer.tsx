import { useEffect, useRef } from 'react'
import { FavStar } from '../../../shared/components/FavStar'
import { CloseIcon } from '../../../shared/components/icons'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'
import type { CompletedCourse, Course } from '../types'
import { CourseDetailBody } from './CourseDetailBody'

interface CourseDetailDrawerProps {
  course: Course
  completedCourse?: CompletedCourse
  isFavorite: boolean
  favoriteDisabled?: boolean
  onToggleFavorite: () => void
  onClose: () => void
}

export function CourseDetailDrawer({
  course,
  completedCourse,
  isFavorite,
  favoriteDisabled = false,
  onToggleFavorite,
  onClose,
}: CourseDetailDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // The catalog list only carries summary data; the full record adds the
  // description, exam dates, prerequisites, and learning platform links.
  const { course: detailCourse } = useCatalogCourseDetail(course.id)
  const displayCourse = detailCourse ?? course

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [course.id])

  return (
    <aside className="flex min-w-0 w-full flex-1 flex-col border-l border-border bg-bg shadow-[-12px_0_32px_rgba(0,0,0,0.12)] md:h-full md:w-[480px] md:max-w-[520px] md:flex-shrink-0 md:flex-none">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-surface px-5 py-3.5">
        <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Course Details
        </span>
        <div className="flex items-center gap-1.5">
          <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close course details"
            className="flex items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <CloseIcon size={18} />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <CourseDetailBody course={displayCourse} completedCourse={completedCourse} />
      </div>
    </aside>
  )
}
