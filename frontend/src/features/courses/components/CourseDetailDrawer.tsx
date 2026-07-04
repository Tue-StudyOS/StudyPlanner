import { useEffect, useLayoutEffect, useRef } from 'react'
import { FavStar } from '../../../shared/components/FavStar'
import { CloseIcon } from '../../../shared/components/icons'
import { useBodyScrollLock } from '../../../shared/hooks/useBodyScrollLock'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { useTranslation } from '../../i18n'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'
import { mergeCourseDetails } from '../utils/mergeCourseDetails.ts'
import type { Course } from '../types'
import { CourseDetailBody } from './CourseDetailBody'

interface CourseDetailDrawerProps {
  courseId: string
  // Summary row from the already-loaded catalog list; paints instantly while
  // the full record loads and stays as fallback if that request fails. Deep
  // links open the drawer before the list row exists, so it may be null.
  listCourse?: Course | null
  isFavorite: boolean
  favoriteDisabled?: boolean
  showFavorite?: boolean
  onToggleFavorite: () => void
  onClose: () => void
}

export function CourseDetailDrawer({
  courseId,
  listCourse = null,
  isFavorite,
  favoriteDisabled = false,
  showFavorite = true,
  onToggleFavorite,
  onClose,
}: CourseDetailDrawerProps) {
  const { t } = useTranslation()
  const isMobileViewport = useMediaQuery('(max-width: 768px)')
  const scrollRef = useRef<HTMLDivElement>(null)

  useBodyScrollLock()
  // The catalog list only carries summary data; the full record adds the
  // description, exam dates, prerequisites, and learning platform links.
  const { course: detailCourse, isLoading, error } = useCatalogCourseDetail(courseId)
  const displayCourse = detailCourse && listCourse
    ? mergeCourseDetails(listCourse, detailCourse)
    : detailCourse ?? listCourse

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [courseId, displayCourse?.id])

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
      className="fixed inset-0 z-[90] overflow-y-auto bg-black/30 backdrop-blur-sm px-4 py-10"
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
            {t('courseDetail.detailsTitle')}
          </span>
          <div className="flex items-center gap-1.5">
            {showFavorite ? (
              <FavStar active={isFavorite} disabled={favoriteDisabled} onToggle={onToggleFavorite} />
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('courseDetail.closeDetails')}
              className="flex items-center justify-center rounded-md p-1.5 text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg"
            >
              <CloseIcon size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-5"
        >
          {displayCourse ? (
            <CourseDetailBody course={displayCourse} />
          ) : (
            <div className="px-4 py-10 text-center text-[13.5px] text-fg-muted">
              {isLoading ? t('courseDetail.loading') : `${t('courseDetail.failed')}${error ? ` ${error}` : ''}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
