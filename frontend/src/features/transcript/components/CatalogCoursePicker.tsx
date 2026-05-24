import { useEffect, useMemo, useState } from 'react'
import { fetchCatalogCourses } from '../../courses/api'
import type { TranscriptCoursePreview } from '../types'
import { toTranscriptCoursePreview } from '../utils/buildTranscriptImportCandidates'

const MIN_QUERY_LENGTH = 2
const SEARCH_RESULT_LIMIT = 6

interface CatalogCoursePickerProps {
  selectedCourse: TranscriptCoursePreview | null
  suggestedCourses?: TranscriptCoursePreview[]
  onSelect: (course: TranscriptCoursePreview) => void
}

function uniqueCourses(courses: TranscriptCoursePreview[]): TranscriptCoursePreview[] {
  const uniqueById = new Map<string, TranscriptCoursePreview>()

  for (const course of courses) {
    if (!uniqueById.has(course.id)) {
      uniqueById.set(course.id, course)
    }
  }

  return [...uniqueById.values()]
}

export function CatalogCoursePicker({
  selectedCourse,
  suggestedCourses = [],
  onSelect,
}: CatalogCoursePickerProps) {
  const [query, setQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<TranscriptCoursePreview[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedQuery = query.trim()
  const hasSearchQuery = trimmedQuery.length >= MIN_QUERY_LENGTH
  const visibleCourses = useMemo(
    () => (hasSearchQuery ? searchResults : uniqueCourses(suggestedCourses).slice(0, SEARCH_RESULT_LIMIT)),
    [hasSearchQuery, searchResults, suggestedCourses],
  )

  useEffect(() => {
    let isActive = true

    async function loadSearchResults(): Promise<void> {
      if (!hasSearchQuery) {
        setSearchResults([])
        setError(null)
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const nextCourses = await fetchCatalogCourses(trimmedQuery, SEARCH_RESULT_LIMIT)
        if (!isActive) {
          return
        }
        setSearchResults(nextCourses.map(toTranscriptCoursePreview))
      } catch (searchError) {
        if (!isActive) {
          return
        }
        setSearchResults([])
        setError(searchError instanceof Error ? searchError.message : 'Catalog search failed.')
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    void loadSearchResults()

    return () => {
      isActive = false
    }
  }, [hasSearchQuery, trimmedQuery])

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Catalog course
        </span>
        {selectedCourse ? (
          <div className="rounded-lg border border-border-light bg-surface px-4 py-3">
            <div className="text-[13px] font-semibold text-fg">{selectedCourse.title}</div>
            <div className="text-[12px] text-fg-muted">
              {selectedCourse.number || 'Catalog course'} · {selectedCourse.ects ?? '–'} ECTS
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
            Choose the matching catalog course before importing.
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search catalog by title or number"
          className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none focus:border-primary"
        />

        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[12.5px] text-rose-700">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-[12.5px] text-fg-muted">Searching catalog courses...</div>
        ) : !hasSearchQuery && visibleCourses.length === 0 ? (
          <div className="text-[12.5px] text-fg-muted">
            Start typing at least {MIN_QUERY_LENGTH} characters to search the catalog.
          </div>
        ) : visibleCourses.length === 0 ? (
          <div className="text-[12.5px] text-fg-muted">No matching catalog courses found.</div>
        ) : (
          <div className="grid gap-2">
            {visibleCourses.map((course) => {
              const isActive = course.id === selectedCourse?.id

              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => onSelect(course)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border-light hover:bg-surface-hover'
                  }`}
                >
                  <div className="text-[12.5px] font-semibold text-fg">{course.title}</div>
                  <div className="text-[12px] text-fg-muted">
                    {course.number || 'Catalog course'} · {course.ects ?? '–'} ECTS
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
