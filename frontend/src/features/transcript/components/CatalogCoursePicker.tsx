import { useEffect, useMemo, useState } from 'react'
import { fetchCatalogCourses } from '../../courses/api'
import type { TranscriptCoursePreview } from '../types'
import { toTranscriptCoursePreview } from '../utils/buildTranscriptImportCandidates'

const MIN_QUERY_LENGTH = 2
const SEARCH_RESULT_LIMIT = 200
const SUGGESTED_RESULT_LIMIT = 6
const SEARCH_DEBOUNCE_MS = 250

interface CatalogCoursePickerProps {
  selectedCourse: TranscriptCoursePreview | null
  suggestedCourses?: TranscriptCoursePreview[]
  studyProgramCode?: string | null
  compact?: boolean
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
  studyProgramCode,
  compact = false,
  onSelect,
}: CatalogCoursePickerProps) {
  const [query, setQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<TranscriptCoursePreview[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedQuery = query.trim()
  const hasSearchQuery = trimmedQuery.length >= MIN_QUERY_LENGTH
  const suggestedResults = useMemo(
    () => uniqueCourses(suggestedCourses).slice(0, SUGGESTED_RESULT_LIMIT),
    [suggestedCourses],
  )
  const visibleCourses = hasSearchQuery ? searchResults : suggestedResults
  const shouldShowResults = hasSearchQuery || (!selectedCourse && suggestedResults.length > 0)

  function handleSelect(course: TranscriptCoursePreview): void {
    setQuery('')
    setSearchResults([])
    onSelect(course)
  }

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
        setSearchResults(nextCourses.map((course) => toTranscriptCoursePreview(course, studyProgramCode)))
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

    const timeoutId = window.setTimeout(() => void loadSearchResults(), hasSearchQuery ? SEARCH_DEBOUNCE_MS : 0)

    return () => {
      isActive = false
      window.clearTimeout(timeoutId)
    }
  }, [hasSearchQuery, studyProgramCode, trimmedQuery])

  return (
    <div className="grid gap-2.5">
      <div className="grid gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
          Catalog course
        </span>
        {selectedCourse ? (
          <div className={`rounded-lg border border-border bg-surface ${compact ? 'px-3 py-2.5' : 'px-4 py-3'}`}>
            <div className={`${compact ? 'text-[12.5px]' : 'text-[13px]'} font-semibold text-fg`}>
              {selectedCourse.title}
            </div>
            <div className="text-[11.5px] text-fg-muted">
              {selectedCourse.number || 'Catalog course'} · {selectedCourse.ects ?? '–'} ECTS
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search catalog by title or number"
          className={`rounded-md border border-border bg-surface text-fg outline-none focus:border-primary ${compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[12.5px]'}`}
        />

        {error ? (
          <div className={`rounded-lg border border-primary/30 bg-primary/5 text-primary ${compact ? 'px-3 py-2.5 text-[12px]' : 'px-4 py-3 text-[12.5px]'}`}>
            {error}
          </div>
        ) : null}

        {shouldShowResults ? (
          isLoading ? (
            <div className="text-[12px] text-fg-muted">Searching catalog courses...</div>
          ) : hasSearchQuery && visibleCourses.length === 0 ? (
            <div className="text-[12px] text-fg-muted">No matching catalog courses found.</div>
          ) : visibleCourses.length > 0 ? (
            <div
              className={`grid gap-1.5 ${hasSearchQuery ? 'max-h-[18rem] overflow-y-auto pr-1' : ''}`}
            >
              {visibleCourses.map((course) => {
                const isActive = course.id === selectedCourse?.id

                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => handleSelect(course)}
                    className={`rounded-lg border text-left transition-colors ${compact ? 'px-2.5 py-2' : 'px-3 py-2'} ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border-light hover:bg-surface-hover'
                    }`}
                  >
                    <div className={`${compact ? 'text-[12px]' : 'text-[12.5px]'} font-semibold text-fg`}>
                      {course.title}
                    </div>
                    <div className="text-[11.5px] text-fg-muted">
                      {course.number || 'Catalog course'} · {course.ects ?? '–'} ECTS
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null
        ) : null}
      </div>
    </div>
  )
}
