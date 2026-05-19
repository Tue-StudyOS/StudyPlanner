import { CourseCard } from '../../../shared/components/CourseCard'
import { useCourses } from '../../courses'
import { useFavorites } from '../hooks/useFavorites'

export function Favorites() {
  const { courses } = useCourses()
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()

  const favoriteCourses = courses.filter((course) => favoriteIds.includes(course.id))

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2">Favorites</h2>
      <p className="text-fg-mid mb-6">Your bookmarked and favorited courses.</p>

      {favoriteCourses.length === 0 ? (
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
              onToggleFavorite={() => toggleFavorite(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
