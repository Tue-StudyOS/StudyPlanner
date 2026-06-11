import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { ROUTES } from '../../routes'
import { useCatalogCourseDetail } from '../hooks/useCatalogCourseDetail'
import { CourseDetailBody } from './CourseDetailBody'

export function CourseDetail() {
  const { courseId } = useParams<{ courseId: string }>()
  const { isAuthenticated } = useAuth()
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
      <div className="p-4 sm:p-8">
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading course details...
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="p-4 sm:p-8">
        <div className="mb-4">
          <Link to={ROUTES.catalog} className="text-[13px] font-medium text-primary hover:underline">
            ← Back to catalog
          </Link>
        </div>
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Failed to load the course detail. {error}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[44rem] p-4 sm:p-8">
      {!isAuthenticated ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          This is public catalog data from the database. Sign in only if you want to save interested courses or personal progress.
        </div>
      ) : null}

      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      <div className="mb-4 flex items-center justify-between gap-4">
        <Link to={ROUTES.catalog} className="text-[13px] font-medium text-primary hover:underline">
          ← Back to catalog
        </Link>
        <button
          type="button"
          onClick={() => toggleFavorite(course.id)}
          disabled={isLoadingFavorites || isSavingFavorites}
          className="rounded-md border border-border bg-surface px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFavorite(course.id) ? 'Remove from interested' : 'Mark as interested'}
        </button>
      </div>

      <CourseDetailBody course={course} />
    </div>
  )
}
