import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useResolvedPath } from 'react-router-dom'
import { CourseCard } from '../../../shared/components/CourseCard'
import { toUserFacingApiMessage } from '../../../shared/utils/userFacingApiError.ts'
import { useTranslation } from '../../i18n'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import {
  buildFlexibleRegulationAreaOptions,
  formatRegulationAreaShortLabel,
  isMandatoryRegulationAreaCode,
  studyAreaCodeToMasterCat,
} from '../../../shared/utils/regulation'
import { useProgressSnapshot } from '../../dashboard/hooks/useProgressSnapshot'
import { useAuth } from '../../auth'
import { useFavorites } from '../../favorites'
import { useOnboarding } from '../../onboarding'
import {
  TOUR_SAMPLE_COURSES,
  getCatalogTourSampleVariant,
  getTourCatalogSampleTarget,
} from '../../onboarding/utils/tourPreviewData.ts'
import { DAY_LABELS, DAY_ORDER } from '../../planner/utils/plannerFeedback'
import { findCompletedCourseForCatalogCourse } from '../../planner/utils/historicalSemesterPlan.ts'
import { useTranscript } from '../../transcript'
import { ALL_CATALOG_PERIODS } from '../api'
import { useCatalogCourses } from '../hooks/useCatalogCourses'
import { useCatalogPeriods } from '../hooks/useCatalogPeriods'
import { useHistoricalLecturerLookup } from '../hooks/useHistoricalLecturerLookup.ts'
import { resolveCourseCardLecturerLabel } from '../utils/completedCourseLecturer.ts'
import type { CompletedCourse, Course, CourseTermType } from '../types'
import {
  encodeCatalogDetailSegment,
  extractCatalogDetailCourseId,
} from '../utils/catalogDetailRoute.ts'
import { getCatalogSeasonGlyphPresentation } from '../utils/catalogSeasonGlyphPresentation.ts'
import {
  getLatestKnownSeasonTermType,
  getOfferingStatus,
  getOutdatedOfferingSortRank,
  isCompulsoryCourse,
  isDefaultVisibleOfferingStatus,
  isOutdatedOfferingStatus,
  resolveUnconfirmedOfferingVisibility,
  type OfferingStatus,
} from '../utils/catalogOffering.ts'
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

function getTourSampleOfferingStatus(variant: 'confirmed' | 'likely' | 'unknown'): OfferingStatus {
  if (variant === 'likely') {
    return 'likely'
  }
  if (variant === 'unknown') {
    return 'unknown'
  }
  return 'confirmed'
}

function UnconfirmedOfferingsToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}): React.ReactElement {
  return (
    <label className="flex min-w-0 cursor-pointer flex-wrap items-center gap-2 border-t border-border-light pt-3 text-[12.5px] font-medium text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
          checked
            ? 'border-primary bg-primary text-white'
            : 'border-border bg-surface text-transparent'
        }`}
      >
        <svg width={12} height={12} viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M2.2 6.2 4.8 8.8 9.8 3.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="min-w-0 break-words">{label}</span>
    </label>
  )
}

export function CoursesOverview() {
  const [search, setSearch] = useState<string>('')
  const [selectedEctsValues, setSelectedEctsValues] = useState<number[]>([])
  const [selectedStudyAreaCodes, setSelectedStudyAreaCodes] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<FilterWeekday[]>([])
  // Time fields store plain digits; the inputs render them masked as HH:MM.
  const [timeFromDigits, setTimeFromDigits] = useState<string>('')
  const [timeToDigits, setTimeToDigits] = useState<string>('')
  const [selectedTerms, setSelectedTerms] = useState<Array<'summer' | 'winter'>>([])
  const [selectedCourseTypes, setSelectedCourseTypes] = useState<CourseTypeFilterValue[]>([])
  const [showOnlyOpenMandatory, setShowOnlyOpenMandatory] = useState<boolean>(false)
  const [showUnconfirmedOfferings, setShowUnconfirmedOfferings] = useState<boolean>(false)
  const [areFiltersOpen, setAreFiltersOpen] = useState<boolean>(false)
  const [sortOption, setSortOption] = useState<CatalogSortOption>('title')
  const filterSignature = useMemo(
    () =>
      [
        search,
        selectedCourseTypes.join('|'),
        selectedDays.join('|'),
        selectedEctsValues.join('|'),
        selectedStudyAreaCodes.join('|'),
        selectedTerms.join('|'),
        showOnlyOpenMandatory,
        showUnconfirmedOfferings,
        sortOption,
        timeFromDigits,
        timeToDigits,
      ].join('::'),
    [
      search,
      selectedCourseTypes,
      selectedDays,
      selectedEctsValues,
      selectedStudyAreaCodes,
      selectedTerms,
      showOnlyOpenMandatory,
      showUnconfirmedOfferings,
      sortOption,
      timeFromDigits,
      timeToDigits,
    ],
  )
  const [paginationState, setPaginationState] = useState<{ signature: string; visibleCount: number }>(() => ({
    signature: filterSignature,
    visibleCount: PAGE_SIZE,
  }))
  if (paginationState.signature !== filterSignature) {
    setPaginationState({ signature: filterSignature, visibleCount: PAGE_SIZE })
  }
  const visibleCount = paginationState.visibleCount
  const [layout, setLayout] = useState<CatalogLayout>(readStoredLayout)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  // The catalog mounts at '/catalog' and '/test/catalog'; resolving '.'
  // against the active route keeps the drawer URL scheme working on both.
  const catalogBasePath = useResolvedPath('.').pathname
  const openCourseId = extractCatalogDetailCourseId(location.pathname, catalogBasePath)
  const { isOpen: isOnboardingOpen, activeStepId } = useOnboarding()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const catalogScrollRef = useRef<HTMLDivElement>(null)
  const preservedScrollTopRef = useRef(0)
  const { user } = useAuth()
  const studyProgramCode = user?.profile.studyProgramCode ?? null
  const { periods, periodsError } = useCatalogPeriods()
  const { courses, isLoading, error } = useCatalogCourses(search, CATALOG_LIMIT, ALL_CATALOG_PERIODS)
  const { regulationVersion, isLoadingRegulationVersion, regulationVersionError } =
    useRegulationVersion(user?.profile.regulationVersionCode)
  const { isFavorite, isLoadingFavorites, isSavingFavorites, favoritesError, toggleFavorite } =
    useFavorites()
  const { completedCourses } = useTranscript()
  const { progressSnapshot } = useProgressSnapshot()
  const historicalLecturerLookup = useHistoricalLecturerLookup(completedCourses, periods)
  const canShowFavorites = true

  const knownPeriodLabels = useMemo(() => periods.map((period) => period.label), [periods])
  const offeringStatusByCourseId = useMemo(() => {
    const statusMap = new Map<string, OfferingStatus>()
    for (const course of courses) {
      statusMap.set(course.id, getOfferingStatus(course, knownPeriodLabels))
    }
    return statusMap
  }, [courses, knownPeriodLabels])
  const latestKnownTermTypeByCourseId = useMemo(() => {
    const termTypeMap = new Map<string, CourseTermType>()
    for (const course of courses) {
      termTypeMap.set(course.id, getLatestKnownSeasonTermType(course, knownPeriodLabels))
    }
    return termTypeMap
  }, [courses, knownPeriodLabels])

  const completedByCatalogCourseId = useMemo(() => {
    const map = new Map<string, CompletedCourse>()
    for (const course of courses) {
      const completed = findCompletedCourseForCatalogCourse(course, completedCourses)
      if (completed) {
        map.set(course.id, completed)
      }
    }
    return map
  }, [courses, completedCourses])

  function getCompletedFor(course: Course): CompletedCourse | undefined {
    return completedByCatalogCourseId.get(course.id)
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPaginationState((current) => ({
            ...current,
            visibleCount: current.visibleCount + PAGE_SIZE,
          }))
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [courses])

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
  const regulationRuleGroups = useMemo(
    () => regulationVersion?.ruleGroups ?? [],
    [regulationVersion?.ruleGroups],
  )

  const openRegulationAreaCodes = useMemo(
    () =>
      (progressSnapshot?.regulationProgress ?? [])
        .filter(
          (area) =>
            area.code.trim().toUpperCase() !== 'THESIS'
            && area.requiredEcts > 0
            && area.earnedEcts < area.requiredEcts,
        )
        .map((area) => area.code),
    [progressSnapshot?.regulationProgress],
  )

  const topicFilterOptions = useMemo(() => {
    const options = new Map(
      topicAreaOptions.map((option) => [option.code, { ...option, isMandatory: false }]),
    )
    for (const code of openRegulationAreaCodes) {
      if (options.has(code)) {
        continue
      }
      const ruleGroup = regulationRuleGroups.find((group) => group.code === code)
      options.set(code, {
        code,
        label: ruleGroup?.name ?? code,
        shortLabel: formatRegulationAreaShortLabel(code, ruleGroup?.groupType),
        masterCat: studyAreaCodeToMasterCat(code),
        isFlexible: false,
        isMandatory: isMandatoryRegulationAreaCode(code, regulationRuleGroups),
      })
    }
    return [...options.values()]
  }, [openRegulationAreaCodes, regulationRuleGroups, topicAreaOptions])

  const timeWindow = useMemo(
    () => ({
      startMinutes: timeDigitsToMinutes(timeFromDigits),
      endMinutes: timeDigitsToMinutes(timeToDigits),
    }),
    [timeFromDigits, timeToDigits],
  )

  const activeCatalogSampleVariant = isOnboardingOpen
    ? getCatalogTourSampleVariant(activeStepId)
      ?? (
        activeStepId === 'catalog-search'
        || activeStepId === 'catalog-filters'
        || activeStepId === 'catalog-progress-hint'
          ? 'confirmed'
          : null
      )
    : null
  const shouldShowUnconfirmedOfferings = resolveUnconfirmedOfferingVisibility(
    showUnconfirmedOfferings,
    isOnboardingOpen,
    activeStepId,
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
          if (!courseMatchesTermFilter(latestKnownTermTypeByCourseId.get(course.id), selectedTerms)) {
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
              && !completedByCatalogCourseId.has(course.id)
            )
          ) {
            return false
          }
          if (
            !shouldShowUnconfirmedOfferings
            && !isDefaultVisibleOfferingStatus(offeringStatusByCourseId.get(course.id))
          ) {
            return false
          }
          return true
        }),
        sortOption,
      // Only stale catalog entries move behind the normal results; likely-but-
      // unconfirmed courses keep the selected catalog order.
      ).sort((left, right) =>
        getOutdatedOfferingSortRank(offeringStatusByCourseId.get(left.id))
        - getOutdatedOfferingSortRank(offeringStatusByCourseId.get(right.id)),
      ),
    [
      completedByCatalogCourseId,
      courses,
      latestKnownTermTypeByCourseId,
      offeringStatusByCourseId,
      selectedCourseTypes,
      selectedDays,
      selectedEctsValues,
      selectedStudyAreaCodes,
      selectedTerms,
      shouldShowUnconfirmedOfferings,
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
    + (showUnconfirmedOfferings ? 1 : 0)
  const hasActiveFilters = activeFilterCount > 0

  function isAreaFilterActive(code: string): boolean {
    if (isMandatoryRegulationAreaCode(code, regulationRuleGroups)) {
      return showOnlyOpenMandatory
    }
    return selectedStudyAreaCodes.includes(code)
  }

  function handleAreaFilterSelect(code: string): void {
    preservedScrollTopRef.current = catalogScrollRef.current?.scrollTop ?? 0
    setAreFiltersOpen(false)
    if (isMandatoryRegulationAreaCode(code, regulationRuleGroups)) {
      setShowOnlyOpenMandatory((current) => !current)
      setSelectedStudyAreaCodes([])
    } else {
      setShowOnlyOpenMandatory(false)
      setSelectedStudyAreaCodes((prev) => toggleInSelection(prev, code))
    }
  }

  useEffect(() => {
    const root = catalogScrollRef.current
    if (!root) return
    root.scrollTop = preservedScrollTopRef.current
  }, [filterSignature])

  function resetAllFilters(): void {
    setSelectedEctsValues([])
    setSelectedStudyAreaCodes([])
    setSelectedDays([])
    setTimeFromDigits('')
    setTimeToDigits('')
    setSelectedTerms([])
    setSelectedCourseTypes([])
    setShowOnlyOpenMandatory(false)
    setShowUnconfirmedOfferings(false)
  }

  const catalogSubtitle = t('catalog.subtitle')
  const hasCatalogRows = filteredCourses.length > 0 || activeCatalogSampleVariant !== null
  const visibleCatalogRows = activeCatalogSampleVariant
    ? [TOUR_SAMPLE_COURSES[activeCatalogSampleVariant], ...visibleCourses.slice(1)]
    : visibleCourses
  const firstOutdatedVisibleCourseId = shouldShowUnconfirmedOfferings
    ? visibleCatalogRows.find((course) => {
      const isTourSampleCourse = Boolean(
        activeCatalogSampleVariant
        && course.id === TOUR_SAMPLE_COURSES[activeCatalogSampleVariant].id,
      )
      return !isTourSampleCourse
        && isOutdatedOfferingStatus(offeringStatusByCourseId.get(course.id))
    })?.id ?? null
    : null
  const gridColsClass = layout === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'

  return (
    <div className="flex min-h-0 min-w-0 md:h-[calc(100dvh-3.75rem)]">
      <div ref={catalogScrollRef} data-tour-scroll-root className="min-w-0 flex-1 md:overflow-y-auto">
      <CatalogProgressHint
        isAreaActive={isAreaFilterActive}
        onSelectArea={handleAreaFilterSelect}
      />
      {/* Capped, centered content width keeps cards readable on wide screens;
          the cap applies to both the one- and two-column layouts. */}
      <div className="mx-auto w-full min-w-0 max-w-[64rem] p-4 sm:p-8 sm:pt-6">

      <h1 className={catalogSubtitle ? 'mb-2 text-[22px] font-semibold tracking-[-0.01em] text-fg' : 'mb-6 text-[22px] font-semibold tracking-[-0.01em] text-fg'}>{t('catalog.title')}</h1>
      {catalogSubtitle ? <p className="mb-6 text-fg-mid">{catalogSubtitle}</p> : null}

      {!isOnboardingOpen && favoritesError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {favoritesError}
        </div>
      ) : null}

      {!isOnboardingOpen && periodsError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {periodsError}
        </div>
      ) : null}

      {!isOnboardingOpen && regulationVersionError ? (
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
                ) : topicFilterOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {topicFilterOptions.map((option) => (
                      <FilterChip
                        key={option.code}
                        label={option.shortLabel}
                        title={option.label}
                        active={option.isMandatory ? showOnlyOpenMandatory : selectedStudyAreaCodes.includes(option.code)}
                        onClick={() => handleAreaFilterSelect(option.code)}
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

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-light pt-3">
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

        <UnconfirmedOfferingsToggle
          checked={showUnconfirmedOfferings}
          label={t('catalog.showUnconfirmedOfferings')}
          onChange={setShowUnconfirmedOfferings}
        />
      </div>

      {isLoading && !isOnboardingOpen ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('catalog.loading')}
        </div>
      ) : error && !isOnboardingOpen ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          <p>{toUserFacingApiMessage(error)}</p>
        </div>
      ) : !hasCatalogRows ? (
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
          <div className={`grid items-stretch gap-3.5 ${gridColsClass}`} data-tour="catalog-card-list">
            {visibleCatalogRows.map((course, index) => {
              const isTourSampleRow = Boolean(
                activeCatalogSampleVariant
                && course.id === TOUR_SAMPLE_COURSES[activeCatalogSampleVariant].id,
              )
              const sampleOfferingStatus = activeCatalogSampleVariant
                ? getTourSampleOfferingStatus(activeCatalogSampleVariant)
                : 'confirmed'
              const offeringStatus = isTourSampleRow
                ? sampleOfferingStatus
                : offeringStatusByCourseId.get(course.id) ?? 'confirmed'
              const shouldShowUnconfirmedDivider = course.id === firstOutdatedVisibleCourseId

              const seasonGlyphPresentation = getCatalogSeasonGlyphPresentation(index)

              return (
                <Fragment key={isTourSampleRow ? `tour-${activeCatalogSampleVariant}` : course.id}>
                  {shouldShowUnconfirmedDivider ? (
                    <div className="col-span-full my-2 flex min-w-0 items-center gap-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
                      <span className="h-px min-w-0 flex-1 bg-border-light" />
                      <span className="max-w-full shrink break-words px-1">
                        {t('catalog.unconfirmedDivider')}
                      </span>
                      <span className="h-px min-w-0 flex-1 bg-border-light" />
                    </div>
                  ) : null}
                  <div
                    className="min-w-0 h-full"
                    data-tour={
                      isTourSampleRow && activeCatalogSampleVariant
                        ? getTourCatalogSampleTarget(activeCatalogSampleVariant)
                        : index === 0 ? 'catalog-card' : undefined
                    }
                  >
                    <CourseCard
                      course={course}
                      detailTo={isTourSampleRow ? undefined : encodeCatalogDetailSegment(course.id)}
                      isFavorite={isTourSampleRow ? false : isFavorite(course.id)}
                      isActive={!isTourSampleRow && openCourseId === course.id}
                      isCompleted={!isTourSampleRow && Boolean(getCompletedFor(course))}
                      lecturerLabel={
                        isTourSampleRow
                          ? undefined
                          : resolveCourseCardLecturerLabel(
                              course,
                              getCompletedFor(course),
                              periods,
                              historicalLecturerLookup,
                            )
                      }
                      favoriteDisabled={isTourSampleRow || isLoadingFavorites || isSavingFavorites}
                      showFavorite={canShowFavorites}
                      offeringStatus={offeringStatus}
                      seasonTermType={isTourSampleRow ? course.termType : latestKnownTermTypeByCourseId.get(course.id) ?? course.termType}
                      seasonLayout={seasonGlyphPresentation.layout}
                      seasonStrength={seasonGlyphPresentation.strength}
                      regulationRuleGroups={regulationRuleGroups}
                      isAreaTagActive={isAreaFilterActive}
                      onAreaTagClick={handleAreaFilterSelect}
                      onToggleFavorite={isTourSampleRow ? () => undefined : () => toggleFavorite(course.id)}
                    />
                  </div>
                </Fragment>
              )
            })}
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
      {openCourseId ? (
        <CourseDetailDrawer
          courseId={openCourseId}
          listCourse={courses.find((course) => course.id === openCourseId) ?? null}
          isFavorite={isFavorite(openCourseId)}
          favoriteDisabled={isLoadingFavorites || isSavingFavorites}
          showFavorite={canShowFavorites}
          onToggleFavorite={() => toggleFavorite(openCourseId)}
          onClose={() => navigate(catalogBasePath)}
        />
      ) : null}
    </div>
  )
}
