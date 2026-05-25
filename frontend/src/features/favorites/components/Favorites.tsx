import { CourseCard } from '../../../shared/components/CourseCard'
import { PersonalFeatureNotice } from '../../../shared/components/PersonalFeatureNotice'
import { useAuth } from '../../auth'
import { useCatalogCourses } from '../../courses'
import { useFavorites } from '../hooks/useFavorites'

function AuthenticatedFavorites() {
  const { courses, isLoading, error } = useCatalogCourses('')
  const {
    favoriteIds,
    isFavorite,
    isLoadingFavorites,
    isSavingFavorites,
    favoritesError,
    toggleFavorite,
  } = useFavorites()

  const favoriteCourses = courses.filter((course) => favoriteIds.includes(course.id))

  return (
    <>
      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      {isLoadingFavorites ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading your saved favorites...
        </div>
      ) : isLoading ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading favorite courses from the database...
        </div>
      ) : error ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Failed to load favorite courses. {error}
        </div>
      ) : favoriteCourses.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          No favorite courses yet. Tap the star on a course to add it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {favoriteCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isFavorite={isFavorite(course.id)}
              favoriteDisabled={isSavingFavorites}
              onToggleFavorite={() => toggleFavorite(course.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

export function Favorites() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="p-4 sm:p-8">
      <h2 className="mb-2 text-2xl font-bold">Favorites</h2>
      <p className="mb-6 text-fg-mid">Your bookmarked and favorited courses.</p>

      {isAuthenticated ? (
        <AuthenticatedFavorites />
      ) : (
        <PersonalFeatureNotice
          title="Favorites stay with your account"
          description="Sign in to save favorite courses across devices. You can still browse the full public catalog without an account."
        />
      )}
    </div>
  )
}
