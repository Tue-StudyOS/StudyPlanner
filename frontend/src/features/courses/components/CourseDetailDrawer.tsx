import { useEffect, useLayoutEffect, useRef } from 'react'
import { FavStar } from '../../../shared/components/FavStar'
import { CloseIcon } from '../../../shared/components/icons'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'
import type { Course } from '../types'
import { CourseDetailBody } from './CourseDetailBody'

interface CourseDetailDrawerProps {
  course: Course
  isFavorite: boolean
  favoriteDisabled?: boolean
  onToggleFavorite: () => void
  onClose: () => void
}

export function CourseDetailDrawer({
  course,
  isFavorite,
  favoriteDisabled = false,
  onToggleFavorite,
  onClose,
}: CourseDetailDrawerProps) {
  const isMobileViewport = useMediaQuery('(max-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)
  // The catalog list only carries summary data; the full record adds the
  // description, exam dates, prerequisites, and learning platform links.
  const { course: detailCourse } = useCatalogCourseDetail(course.id)
  const displayCourse = detailCourse ?? course

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [course.id, displayCourse.id])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/30 px-4 py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={
          isMobileViewport
            ? 'absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[18px] border-t border-border bg-bg shadow-2xl'
            : 'mx-auto mt-22 mb-10 flex max-h-[78dvh] w-[34rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[14px] border border-border bg-bg shadow-2xl'
        }
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3.5 sm:px-5">
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

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-5"
        >
          <CourseDetailBody course={displayCourse} />
        </div>
      </div>
    </div>
  )
}
