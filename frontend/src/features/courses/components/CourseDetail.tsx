import { Link, useParams } from 'react-router-dom'
import { PageShell } from '../../../shared/components/PageShell'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { useTranslation } from '../../i18n'
import { ROUTES } from '../../routes'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'
import { CourseDetailBody } from './CourseDetailBody'

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const { course, isLoading, error } = useCatalogCourseDetail(courseId)
  const {
    isFavorite,
    isLoadingFavorites,
    isSavingFavorites,
    favoritesError,
    toggleFavorite,
  } = useFavorites()

  if (isLoading) {
    return (
      <PageShell width="narrow">
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('courseDetail.loading')}
        </div>
      </PageShell>
    )
  }

  if (error || !course) {
    return (
      <PageShell width="narrow">
        <div className="mb-4">
          <Link to={ROUTES.catalog} className="text-[13px] font-medium text-primary hover:underline">
            {t('courseDetail.back')}
          </Link>
        </div>
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('courseDetail.failed')} {error}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell width="narrow">
      {!isAuthenticated ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          {t('courseDetail.publicNotice')}
        </div>
      ) : null}

      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-4">
        <Link to={ROUTES.catalog} className="text-[13px] font-medium text-primary hover:underline">
          {t('courseDetail.back')}
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(course.id)}
          disabled={isLoadingFavorites || isSavingFavorites}
          className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFavorite(course.id) ? t('courseDetail.removeInterested') : t('courseDetail.markInterested')}
        </button>
      </div>

      <CourseDetailBody course={course} />
    </PageShell>
  )
}
