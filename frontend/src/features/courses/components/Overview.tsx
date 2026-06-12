import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CourseCard } from '../../../shared/components/CourseCard'
import { useTranslation } from '../../i18n'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { buildFlexibleRegulationAreaOptions } from '../../../shared/utils/regulation'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { DAY_LABELS, DAY_ORDER } from '../../planner/utils/plannerFeedback'
import { useTranscript } from '../../transcript'
import { ALL_CATALOG_PERIODS } from '../api'
import { useCatalogCourses } from '../hooks/useCatalogCourses'
import { useCatalogPeriods } from '../hooks/useCatalogPeriods'
import type { CompletedCourse, Course, CourseTermType } from '../types'
import { getOfferingStatus, isCompulsoryCourse, type OfferingStatus } from '../utils/catalogOffering.ts'
import {
  CATALOG_SORT_LABELS,
  sortCatalogCourses,
  type CatalogSortOption,
} from '../utils/catalogSorting.ts'
import {
  courseMatchesTimeFilter,
  type FilterWeekday,
} from '../utils/courseTimeFilters.ts'
import {
  COURSE_TYPE_FILTERS,
  courseMatchesTypeFilter,
  type CourseTypeFilterValue,
} from '../utils/courseTypeFilter.ts'
import { courseMatchesStudyAreaFilter } from '../utils/studyAreaFilter.ts'
import { timeDigitsToMinutes } from '../utils/timeInput.ts'
import { CatalogProgressHint } from './CatalogProgressHint'
import { CourseDetailDrawer } from './CourseDetailDrawer'
import { TimeRangeInputs } from './TimeRangeInputs'

const PAGE_SIZE = 30
const CATALOG_LIMIT = 1000
const CATALOG_LAYOUT_STORAGE_KEY = 'studyplaner.catalogLayout'

type CatalogLayout = 'grid' | 'list'

function readStoredLayout(): CatalogLayout {
  if (typeof window === 'undefined') {
    return 'grid'
  }
  return window.localStorage.getItem(CATALOG_LAYOUT_STORAGE_KEY) === 'list' ? 'list' : 'grid'
}

function FilterChip({
  label,
  active,
  title,
  onClick,
}: {
  label: string
  active: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

function toggleInSelection<T>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item]
}

// Shows the layout the button switches TO: 2x2 squares for the two-column
// grid, stacked bars for the single column.
function LayoutPreviewIcon({ next }: { next: CatalogLayout }) {
  if (next === 'grid') {
    return (
      <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <rect x="1.5" y="1.5" width="5.6" height="5.6" rx="1.2" />
        <rect x="8.9" y="1.5" width="5.6" height="5.6" rx="1.2" />
        <rect x="1.5" y="8.9" width="5.6" height="5.6" rx="1.2" />
        <rect x="8.9" y="8.9" width="5.6" height="5.6" rx="1.2" />
      </svg>
    )
  }
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="1.5" y="2" width="13" height="5" rx="1.2" />
      <rect x="1.5" y="9" width="13" height="5" rx="1.2" />
    </svg>
  )
}

const TERM_FILTER_OPTIONS: Array<{ value: 'summer' | 'winter'; label: string }> = [
  { value: 'summer', label: 'Summer term' },
  { value: 'winter', label: 'Winter term' },
]

function courseMatchesTermFilter(
  termType: CourseTermType | undefined,
  selectedTerms: Array<'summer' | 'winter'>,
): boolean {
  if (selectedTerms.length === 0) {
    return true
  }
  if (termType === 'both') {
    return true
  }
  return termType === 'summer' || termType === 'winter'
    ? selectedTerms.includes(termType)
    : false
}

export function CoursesOverview() {
  const [search, setSearch] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)
  const [selectedEctsValues, setSelectedEctsValues] = useState<number[]>([])
  const [selectedStudyAreaCodes, setSelectedStudyAreaCodes] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<FilterWeekday[]>([])
  // Time fields store plain digits; the inputs render them masked as HH:MM.
  const [timeFromDigits, setTimeFromDigits] = useState<string>('')
  const [timeToDigits, setTimeToDigits] = useState<string>('')
  const [selectedTerms, setSelectedTerms] = useState<Array<'summer' | 'winter'>>([])
  const [selectedCourseTypes, setSelectedCourseTypes] = useState<CourseTypeFilterValue[]>([])
  const [showOnlyOpenMandatory, setShowOnlyOpenMandatory] = useState<boolean>(false)
  const [hideUnknownOfferings, setHideUnknownOfferings] = useState<boolean>(false)
  const [areFiltersOpen, setAreFiltersOpen] = useState<boolean>(false)
  const [sortOption, setSortOption] = useState<CatalogSortOption>('title')
  const [layout, setLayout] = useState<CatalogLayout>(readStoredLayout)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const { t } = useTranslation()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const selectedCardRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, user } = useAuth()
  const studyProgramCode = user?.profile.studyProgramCode ?? null
  const { periods, periodsError } = useCatalogPeriods()
  const { courses, isLoading, error } = useCatalogCourses(search, CATALOG_LIMIT, ALL_CATALOG_PERIODS)
  const { regulationVersion, isLoadingRegulationVersion, regulationVersionError } =
    useRegulationVersion(user?.profile.regulationVersionCode)
  const { isFavorite, isLoadingFavorites, isSavingFavorites, favoritesError, toggleFavorite } =
    useFavorites()
  const { completedCourses } = useTranscript()

  const knownPeriodLabels = useMemo(() => periods.map((period) => period.label), [periods])
  const offeringStatusByCourseId = useMemo(() => {
    const statusMap = new Map<string, OfferingStatus>()
    for (const course of courses) {
      statusMap.set(course.id, getOfferingStatus(course, knownPeriodLabels))
    }
    return statusMap
  }, [courses, knownPeriodLabels])

  const completedByCourseKey = useMemo(() => {
    const map = new Map<string, CompletedCourse>()
    for (const completed of completedCourses) {
      if (completed.courseId) map.set(completed.courseId, completed)
      if (completed.courseNumber) map.set(completed.courseNumber, completed)
      if (completed.externalCourseCode) map.set(completed.externalCourseCode, completed)
    }
    return map
  }, [completedCourses])

  function getCompletedFor(course: Course): CompletedCourse | undefined {
    return completedByCourseKey.get(course.id) ?? completedByCourseKey.get(course.number)
  }

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

  // Keep the clicked card visible when the grid collapses to one column for
  // the detail drawer, so the selected course never jumps out of view.
  useLayoutEffect(() => {
    if (selectedCourse) {
      selectedCardRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedCourse])

  useEffect(() => {
    window.localStorage.setItem(CATALOG_LAYOUT_STORAGE_KEY, layout)
  }, [layout])

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

  const timeWindow = useMemo(
    () => ({
      startMinutes: timeDigitsToMinutes(timeFromDigits),
      endMinutes: timeDigitsToMinutes(timeToDigits),
    }),
    [timeFromDigits, timeToDigits],
  )

  const filteredCourses = useMemo(
    () =>
      sortCatalogCourses(
        courses.filter((course) => {
          if (selectedEctsValues.length > 0 && (!course.ects || !selectedEctsValues.includes(course.ects))) {
            return false
          }
          if (!courseMatchesStudyAreaFilter(course, selectedStudyAreaCodes, studyProgramCode)) {
            return false
          }
          if (!courseMatchesTermFilter(course.termType, selectedTerms)) {
            return false
          }
          if (!courseMatchesTypeFilter(course, selectedCourseTypes)) {
            return false
          }
          if (!courseMatchesTimeFilter(course, selectedDays, timeWindow)) {
            return false
          }
          if (
            showOnlyOpenMandatory
            && !(
              isCompulsoryCourse(course)
              && !completedByCourseKey.get(course.id)
              && !completedByCourseKey.get(course.number)
            )
          ) {
            return false
          }
          if (hideUnknownOfferings && offeringStatusByCourseId.get(course.id) === 'unknown') {
            return false
          }
          return true
        }),
        sortOption,
      // Courses without current offering data sort behind everything else so
      // they never mix into the regular results.
      ).sort((left, right) => {
        const leftUnknown = offeringStatusByCourseId.get(left.id) === 'unknown' ? 1 : 0
        const rightUnknown = offeringStatusByCourseId.get(right.id) === 'unknown' ? 1 : 0
        return leftUnknown - rightUnknown
      }),
    [
      completedByCourseKey,
      courses,
      hideUnknownOfferings,
      offeringStatusByCourseId,
      selectedCourseTypes,
      selectedDays,
      selectedEctsValues,
      selectedStudyAreaCodes,
      selectedTerms,
      showOnlyOpenMandatory,
      sortOption,
      studyProgramCode,
      timeWindow,
    ],
  )

  const visibleCourses = filteredCourses.slice(0, visibleCount)
  const hasMore = visibleCount < filteredCourses.length
  const activeFilterCount =
    selectedEctsValues.length
    + selectedStudyAreaCodes.length
    + selectedDays.length
    + (timeWindow.startMinutes !== null ? 1 : 0)
    + (timeWindow.endMinutes !== null ? 1 : 0)
    + selectedTerms.length
    + selectedCourseTypes.length
    + (showOnlyOpenMandatory ? 1 : 0)
    + (hideUnknownOfferings ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0

  function resetAllFilters(): void {
    setSelectedEctsValues([])
    setSelectedStudyAreaCodes([])
    setSelectedDays([])
    setTimeFromDigits('')
    setTimeToDigits('')
    setSelectedTerms([])
    setSelectedCourseTypes([])
    setShowOnlyOpenMandatory(false)
    setHideUnknownOfferings(false)
  }

  const isDrawerOpen = selectedCourse !== null
  const gridColsClass =
    layout === 'list' || isDrawerOpen ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'

  return (
    <div className="flex min-h-0 min-w-0 md:h-[calc(100dvh-3.75rem)]">
      <div className={`min-w-0 flex-1 md:overflow-y-auto ${isDrawerOpen ? 'hidden md:block' : ''}`}>
      <CatalogProgressHint />
      {/* Capped, centered content width keeps cards readable on wide screens;
          the cap applies to both the one- and two-column layouts. */}
      <div className="mx-auto w-full min-w-0 max-w-[64rem] p-4 sm:p-8 sm:pt-6">

      <h1 className="mb-2 text-[22px] font-semibold tracking-[-0.01em] text-fg">{t('catalog.title')}</h1>
      <p className="mb-6 text-fg-mid">{t('catalog.subtitle')}</p>

      {!isAuthenticated ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          {t('catalog.publicNotice')}
        </div>
      ) : null}

      {favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      {periodsError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {periodsError}
        </div>
      ) : null}

      {regulationVersionError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {regulationVersionError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 rounded-[10px] border border-border bg-surface px-5 py-5">
        <label className="block" data-tour="catalog-search">
          <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
            {t('catalog.search')}
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('catalog.searchPlaceholder')}
            className="w-full rounded-[10px] border border-border bg-surface px-4 py-3 text-[13.5px] text-fg outline-none transition-colors placeholder:text-fg-muted focus:border-primary"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2.5" data-tour="catalog-filters">
          <button
            type="button"
            onClick={() => setAreFiltersOpen((open) => !open)}
            aria-expanded={areFiltersOpen}
            className={`rounded-md border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
              hasActiveFilters
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-border bg-surface text-fg hover:bg-surface-hover'
            }`}
          >
            {t('catalog.filters')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} {areFiltersOpen ? '▴' : '▾'}
          </button>

          <label className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-fg-muted">{t('catalog.sort')}</span>
            <select
              aria-label="Sort courses"
              value={sortOption}
              onChange={(event) => setSortOption(event.target.value as CatalogSortOption)}
              className="rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none transition-colors focus:border-primary"
            >
              {Object.entries(CATALOG_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <span className="flex-1" />

          <button
            type="button"
            onClick={() => setLayout((current) => (current === 'grid' ? 'list' : 'grid'))}
            aria-label={layout === 'grid' ? 'Switch to single-column view' : 'Switch to two-column view'}
            title={layout === 'grid' ? 'Single column' : 'Two columns'}
            className="hidden h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg md:flex"
          >
            <LayoutPreviewIcon next={layout === 'grid' ? 'list' : 'grid'} />
          </button>
        </div>

        {areFiltersOpen ? (
          <div className="grid gap-4 border-t border-border-light pt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <FilterGroup label="ECTS">
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
              </FilterGroup>

              <FilterGroup label="Topic areas">
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
                    Select a study program with an active examination regulation in Account to filter
                    the catalog by regulation topic areas.
                  </div>
                )}
              </FilterGroup>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FilterGroup label="Weekdays">
                <div className="flex flex-wrap gap-2">
                  {DAY_ORDER.map((day) => (
                    <FilterChip
                      key={day}
                      label={DAY_LABELS[day]}
                      active={selectedDays.includes(day)}
                      onClick={() => setSelectedDays((prev) => toggleInSelection(prev, day))}
                    />
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Time window">
                <TimeRangeInputs
                  fromDigits={timeFromDigits}
                  toDigits={timeToDigits}
                  onChangeFrom={setTimeFromDigits}
                  onChangeTo={setTimeToDigits}
                />
              </FilterGroup>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <FilterGroup label="Course type">
                <div className="flex flex-wrap gap-2">
                  {COURSE_TYPE_FILTERS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={selectedCourseTypes.includes(option.value)}
                      onClick={() =>
                        setSelectedCourseTypes((prev) => toggleInSelection(prev, option.value))
                      }
                    />
                  ))}
                </div>
              </FilterGroup>

              <FilterGroup label="Term">
                <div className="flex flex-wrap gap-2">
                  {TERM_FILTER_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      active={selectedTerms.includes(option.value)}
                      onClick={() => setSelectedTerms((prev) => toggleInSelection(prev, option.value))}
                    />
                  ))}
                </div>
              </FilterGroup>
            </div>

            <FilterGroup label="Degree requirements">
              <FilterChip
                label="Mandatory courses I still need"
                active={showOnlyOpenMandatory}
                onClick={() => setShowOnlyOpenMandatory((value) => !value)}
              />
            </FilterGroup>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light pt-3">
              <FilterChip
                label="Apply filter"
                title="Hide courses without current offering data"
                active={hideUnknownOfferings}
                onClick={() => setHideUnknownOfferings((value) => !value)}
              />
              <button
                type="button"
                onClick={resetAllFilters}
                disabled={!hasActiveFilters}
                className="rounded-md border border-border px-3 py-2 text-[12px] font-medium text-fg transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reset filters
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('catalog.loading')}
        </div>
      ) : error ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('catalog.failed')} {error}
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {hasActiveFilters
            ? t('catalog.noFilterResults')
            : t('catalog.noResults')}
        </div>
      ) : (
        <>
          <div className="mb-4 text-[12.5px] text-fg-muted">
            Showing {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
            {hasActiveFilters ? ' after applying the active filters.' : '.'}
          </div>
          <div className={`grid items-stretch gap-3.5 ${gridColsClass}`}>
            {visibleCourses.map((course, index) => (
              <div
                key={course.id}
                className="min-w-0 h-full"
                data-tour={
                  index === 0
                    ? 'catalog-card'
                    : index === visibleCourses.findIndex((c) => offeringStatusByCourseId.get(c.id) === 'likely')
                      ? 'catalog-card-likely'
                      : index === visibleCourses.findIndex((c) => offeringStatusByCourseId.get(c.id) === 'unknown')
                        ? 'catalog-card-unknown'
                        : undefined
                }
              >
                <CourseCard
                  ref={selectedCourse?.id === course.id ? selectedCardRef : undefined}
                  course={course}
                  isFavorite={isFavorite(course.id)}
                  isActive={selectedCourse?.id === course.id}
                  isCompleted={Boolean(getCompletedFor(course))}
                  favoriteDisabled={isLoadingFavorites || isSavingFavorites}
                  offeringStatus={offeringStatusByCourseId.get(course.id) ?? 'confirmed'}
                  onSelect={() => setSelectedCourse(course)}
                  onToggleFavorite={() => toggleFavorite(course.id)}
                />
              </div>
            ))}
          </div>
          {hasMore ? (
            <div ref={sentinelRef} className="mt-6 text-center text-[13px] text-fg-muted">
              {t('catalog.loadingMore')}
            </div>
          ) : filteredCourses.length > PAGE_SIZE ? (
            <div className="mt-6 text-center text-[13px] text-fg-muted">
              {t('catalog.allShown', { count: filteredCourses.length })}
            </div>
          ) : null}
        </>
      )}
      </div>
      </div>
      {selectedCourse ? (
        <CourseDetailDrawer
          course={selectedCourse}
          completedCourse={getCompletedFor(selectedCourse)}
          isFavorite={isFavorite(selectedCourse.id)}
          favoriteDisabled={isLoadingFavorites || isSavingFavorites}
          onToggleFavorite={() => toggleFavorite(selectedCourse.id)}
          onClose={() => setSelectedCourse(null)}
        />
      ) : null}
    </div>
  )
}
