import { useMemo, useState } from 'react'
import { ALL_CATALOG_PERIODS, useCatalogCourses } from '../../courses'
import type { TranscriptCoursePreview } from '../types'
import { toTranscriptCoursePreview } from '../utils/buildTranscriptImportCandidates'

const MIN_QUERY_LENGTH = 2
const SEARCH_RESULT_LIMIT = 200
const SUGGESTED_RESULT_LIMIT = 6
// Mirrors the transcript page's catalog load so this picker reuses the same
// cached result instead of issuing its own network search per keystroke.
const CATALOG_PICKER_LIMIT = 1000

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
  const { courses: catalogCourses, isLoading: isCatalogLoading, error: catalogError } =
    useCatalogCourses('', CATALOG_PICKER_LIMIT, ALL_CATALOG_PERIODS)

  const trimmedQuery = query.trim()
  const hasSearchQuery = trimmedQuery.length >= MIN_QUERY_LENGTH

  // The transcript page already loads the full catalog, so reuse that cached
  // list and filter locally instead of round-tripping to the server per query.
  const catalogPreviews = useMemo(
    () => catalogCourses.map((course) => toTranscriptCoursePreview(course, studyProgramCode)),
    [catalogCourses, studyProgramCode],
  )
  const searchResults = useMemo(() => {
    if (!hasSearchQuery) {
      return []
    }
    const needle = trimmedQuery.toLowerCase()
    return catalogPreviews
      .filter(
        (course) =>
          course.title.toLowerCase().includes(needle)
          || (course.number ?? '').toLowerCase().includes(needle),
      )
      .slice(0, SEARCH_RESULT_LIMIT)
  }, [catalogPreviews, hasSearchQuery, trimmedQuery])

  const suggestedResults = useMemo(
    () => uniqueCourses(suggestedCourses).slice(0, SUGGESTED_RESULT_LIMIT),
    [suggestedCourses],
  )
  const visibleCourses = hasSearchQuery ? searchResults : suggestedResults
  const shouldShowResults = hasSearchQuery || (!selectedCourse && suggestedResults.length > 0)
  const isLoading = hasSearchQuery && isCatalogLoading && catalogPreviews.length === 0
  const error = catalogError

  function handleSelect(course: TranscriptCoursePreview): void {
    setQuery('')
    onSelect(course)
  }

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
          className={`rounded-md border border-border bg-surface text-fg outline-none focus:border-fg-mid ${compact ? 'px-2.5 py-1.5 text-[12px]' : 'px-3 py-2 text-[12.5px]'}`}
        />

        {error ? (
          <div className={`rounded-lg border border-danger/30 bg-danger-soft text-danger ${compact ? 'px-3 py-2.5 text-[12px]' : 'px-4 py-3 text-[12.5px]'}`}>
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
              className={`grid gap-1.5 ${hasSearchQuery ? `${compact ? 'max-h-[8.5rem]' : 'max-h-[18rem]'} overflow-y-auto pr-1` : ''}`}
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
