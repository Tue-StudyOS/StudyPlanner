import { useState } from 'react'
import { CourseCard } from '../../../shared/components/CourseCard'
import { useFavorites } from '../../favorites'
import { useCatalogCourses } from '../hooks/useCatalogCourses'

export function CoursesOverview() {
  const [search, setSearch] = useState<string>('')
  const { courses, isLoading, error } = useCatalogCourses(search)
  const {
    isFavorite,
    isLoadingFavorites,
    isSavingFavorites,
    favoritesError,
    toggleFavorite,
  } = useFavorites()

  return (
    <div className="p-8">
      <h2 className="mb-2 text-2xl font-bold">Course Catalog</h2>
      <p className="mb-6 text-fg-mid">Browse the Informatics catalog from the database.</p>

      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      {isSavingFavorites ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          Saving your favorites...
        </div>
      ) : null}

      <label className="mb-6 block">
        <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Search
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by title, number, or organization"
          className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
        />
      </label>

      {isLoading ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading courses from the database...
        </div>
      ) : error ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Failed to load the catalog. {error}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          No courses match the current search.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              isFavorite={isFavorite(course.id)}
              favoriteDisabled={isLoadingFavorites || isSavingFavorites}
              onToggleFavorite={() => toggleFavorite(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
