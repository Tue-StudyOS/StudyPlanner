import { useEffect, useMemo, useRef, useState } from 'react'
import { CourseCard } from '../../../shared/components/CourseCard'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import {
  buildFlexibleRegulationAreaOptions,
  buildRelevantCourseAreaOptions,
} from '../../../shared/utils/regulation'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { useCatalogCourses } from '../hooks/useCatalogCourses'
import type { Course } from '../types'

const PAGE_SIZE = 30
const CATALOG_LIMIT = 500

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-surface text-fg-muted hover:bg-surface-hover hover:text-fg'
      }`}
    >
      {label}
    </button>
  )
}

function toggleInSelection<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item]
}

function courseMatchesStudyAreaFilter(
  course: Course,
  selectedStudyAreaCodes: string[],
  studyProgramCode: string | null | undefined,
): boolean {
  if (selectedStudyAreaCodes.length === 0) {
    return true
  }
  const relevantAreaCodes = buildRelevantCourseAreaOptions(course.studyAreaOptions, studyProgramCode).map(
    (option) => option.code,
  )
  return selectedStudyAreaCodes.some((code) => relevantAreaCodes.includes(code))
}

export function CoursesOverview() {
  const [search, setSearch] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)
  const [selectedEctsValues, setSelectedEctsValues] = useState<number[]>([])
  const [selectedStudyAreaCodes, setSelectedStudyAreaCodes] = useState<string[]>([])
  const sentinelRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, user } = useAuth()
  const studyProgramCode = user?.profile.studyProgramCode ?? null
  const { courses, isLoading, error } = useCatalogCourses(search, CATALOG_LIMIT)
  const { regulationVersion, isLoadingRegulationVersion, regulationVersionError } =
    useRegulationVersion(user?.profile.regulationVersionCode)
  const { isFavorite, isLoadingFavorites, isSavingFavorites, favoritesError, toggleFavorite } =
    useFavorites()

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setVisibleCount((prev) => prev + PAGE_SIZE)
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [courses])

  const availableEctsValues = useMemo(
    () =>
      [...new Set(courses.map((c) => c.ects).filter((v): v is number => v !== null))].sort(
        (a, b) => a - b,
      ),
    [courses],
  )

  const topicAreaOptions = useMemo(
    () => buildFlexibleRegulationAreaOptions(regulationVersion?.ruleGroups ?? []),
    [regulationVersion?.ruleGroups],
  )

  const filteredCourses = useMemo(
    () =>
      courses.filter((course) => {
        if (selectedEctsValues.length > 0 && (!course.ects || !selectedEctsValues.includes(course.ects))) {
          return false
        }
        return courseMatchesStudyAreaFilter(course, selectedStudyAreaCodes, studyProgramCode)
      }),
    [courses, selectedEctsValues, selectedStudyAreaCodes, studyProgramCode],
  )

  const visibleCourses = filteredCourses.slice(0, visibleCount)
  const hasMore = visibleCount < filteredCourses.length
  const hasActiveFilters = selectedEctsValues.length > 0 || selectedStudyAreaCodes.length > 0

  return (
    <div className="p-4 sm:p-8">
      <h2 className="mb-2 text-2xl font-bold">Course Catalog</h2>
      <p className="mb-6 text-fg-mid">Browse the Informatics catalog from the database.</p>

      {!isAuthenticated ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          Public browsing is enabled. You only need an account for personal features such as
          favorites and progress.
        </div>
      ) : null}

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

      {regulationVersionError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {regulationVersionError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 rounded-[10px] border border-border bg-surface px-5 py-5">
        <label className="block">
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                ECTS filter
              </span>
              {selectedEctsValues.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedEctsValues([])}
                  className="text-[11px] font-medium text-fg-muted hover:text-fg"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {availableEctsValues.map((ectsValue) => (
                <FilterChip
                  key={ectsValue}
                  label={`${ectsValue} ECTS`}
                  active={selectedEctsValues.includes(ectsValue)}
                  onClick={() =>
                    setSelectedEctsValues((prev) =>
                      toggleInSelection(prev, ectsValue).sort((a, b) => a - b),
                    )
                  }
                />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                Topic areas
              </span>
              {selectedStudyAreaCodes.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setSelectedStudyAreaCodes([])}
                  className="text-[11px] font-medium text-fg-muted hover:text-fg"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {isLoadingRegulationVersion ? (
              <div className="text-[12.5px] text-fg-muted">Loading your active regulation filters...</div>
            ) : topicAreaOptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {topicAreaOptions.map((option) => (
                  <FilterChip
                    key={option.code}
                    label={option.code}
                    active={selectedStudyAreaCodes.includes(option.code)}
                    onClick={() =>
                      setSelectedStudyAreaCodes((prev) => toggleInSelection(prev, option.code))
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-3 text-[12.5px] text-fg-muted">
                Select a study program with an active examination regulation in Account to filter the
                catalog by regulation topic areas.
              </div>
            )}
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedEctsValues([])
                setSelectedStudyAreaCodes([])
              }}
              className="rounded-md border border-border px-3 py-2 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover"
            >
              Reset all filters
            </button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Loading courses from the database...
        </div>
      ) : error ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          Failed to load the catalog. {error}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {hasActiveFilters
            ? 'No courses match the current search and filter selection.'
            : 'No courses match the current search.'}
        </div>
      ) : (
        <>
          <div className="mb-4 text-[12.5px] text-fg-muted">
            Showing {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' after applying the active filters.' : '.'}
          </div>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {visibleCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                isFavorite={isFavorite(course.id)}
                favoriteDisabled={isLoadingFavorites || isSavingFavorites}
                onToggleFavorite={() => toggleFavorite(course.id)}
              />
            ))}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="mt-6 text-center text-[13px] text-fg-muted">
              Loading more courses...
            </div>
          ) : filteredCourses.length > PAGE_SIZE ? (
            <div className="mt-6 text-center text-[13px] text-fg-muted">
              All {filteredCourses.length} matching courses shown.
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
