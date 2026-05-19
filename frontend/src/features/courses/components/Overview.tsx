import { CourseCard } from '../../../shared/components/CourseCard'
import { useFavorites } from '../../favorites'
import { useCourses } from '../hooks/useCourses'

export function CoursesOverview() {
  const { courses } = useCourses()
  const { isFavorite, toggleFavorite } = useFavorites()

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-2">Course Catalog</h2>
      <p className="text-fg-mid mb-6">Browse and search all available courses.</p>
      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            isFavorite={isFavorite(course.id)}
            onToggleFavorite={() => toggleFavorite(course.id)}
          />
        ))}
      </div>
    </div>
  )
}
