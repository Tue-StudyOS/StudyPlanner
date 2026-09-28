import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useResolvedPath } from 'react-router-dom'
import { CourseCard } from '../../../shared/components/CourseCard'
import { useTranslation } from '../../i18n'
import { useRegulationVersion } from '../../../shared/hooks/useRegulationVersion'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { saveBrowserPreference } from '../../../shared/utils/browserPreferences.ts'
import {
  buildAllSelectableRegulationAreaOptions,
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
import { useGuestStudyProgram } from '../hooks/useGuestStudyProgram.ts'
import { useHistoricalLecturerLookup } from '../hooks/useHistoricalLecturerLookup.ts'
import { resolveCourseCardLecturerLabel } from '../utils/completedCourseLecturer.ts'
import type { CompletedCourse, Course, CourseTermType } from '../types'
import {
  encodeCatalogDetailSegment,
  extractCatalogDetailCourseId,
} from '../utils/catalogDetailRoute.ts'
import {
  courseRanInSeasons,
  getCatalogCardSeasonTermType,
  getDefaultCatalogTermSelection,
  getOfferingStatus,
  isCompulsoryCourse,
  type OfferingStatus,
  type TermSeason,
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
import { resolveCatalogStudySelection } from '../utils/catalogStudyProgram.ts'
import { courseMatchesStudyAreaFilter } from '../utils/studyAreaFilter.ts'
import { timeDigitsToMinutes } from '../utils/timeInput.ts'
import { CatalogProgressHint } from './CatalogProgressHint'
import { CourseDetailDrawer } from './CourseDetailDrawer'
import { TimeRangeInputs } from './TimeRangeInputs'

const PAGE_SIZE = 30
const CATALOG_LIMIT = 1000
type CatalogLayout = 'grid' | 'list'

function readStoredLayout(): CatalogLayout {
  if (typeof window === 'undefined') {
    return 'grid'
  }
  try {
    return window.localStorage.getItem(BROWSER_STORAGE_KEYS.catalogLayout) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
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

const TERM_FILTER_OPTIONS: Array<{ value: TermSeason; label: string }> = [
  { value: 'summer', label: 'Summer term' },
  { value: 'winter', label: 'Winter term' },
]

function getTourSampleOfferingStatus(variant: 'confirmed' | 'likely' | 'unknown'): OfferingStatus {
  if (variant === 'likely') {
    return 'likely'
  }
  if (variant === 'unknown') {
    return 'unknown'
  }
  return 'confirmed'
}

export function CoursesOverview() {
  const [search, setSearch] = useState<string>('')
  const [selectedEctsValues, setSelectedEctsValues] = useState<number[]>([])
  const [selectedStudyAreaCodes, setSelectedStudyAreaCodes] = useState<string[]>([])
  const [selectedDays, setSelectedDays] = useState<FilterWeekday[]>([])
  // Time fields store plain digits; the inputs render them masked as HH:MM.
  const [timeFromDigits, setTimeFromDigits] = useState<string>('')
  const [timeToDigits, setTimeToDigits] = useState<string>('')
  const [selectedTerms, setSelectedTerms] = useState<TermSeason[]>(() => getDefaultCatalogTermSelection())
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
  const sentinelRef = useRef<HTMLButtonElement>(null)
  const catalogScrollRef = useRef<HTMLDivElement>(null)
  const preservedScrollTopRef = useRef(0)
  const { user, isLoadingSession } = useAuth()
  const accountStudyProgramCode = user?.profile.studyProgramCode ?? null
  const showGuestStudyProgram = !isLoadingSession && accountStudyProgramCode === null
  const {
    studyPrograms,
    selectedStudyProgramId,
    isLoadingStudyPrograms,
    studyProgramsError,
    setSelectedStudyProgramId,
  } = useGuestStudyProgram(showGuestStudyProgram)
  const guestStudyProgram = studyPrograms.find((program) => program.id === selectedStudyProgramId) ?? null
  const { studyProgramCode, regulationVersionCode } = resolveCatalogStudySelection(
    accountStudyProgramCode
      ? {
          studyProgramCode: accountStudyProgramCode,
          regulationVersionCode: user?.profile.regulationVersionCode ?? null,
        }
      : null,
    guestStudyProgram
      ? {
          studyProgramCode: guestStudyProgram.code,
          regulationVersionCode: guestStudyProgram.defaultRegulationVersionCode,
        }
      : null,
  )
  const { periods, periodsError } = useCatalogPeriods()
  const catalogSearch = search.trim().length >= 2 ? search : ''
  const { courses, isLoading, error, refreshWarning } = useCatalogCourses(catalogSearch, CATALOG_LIMIT, ALL_CATALOG_PERIODS)
  const { regulationVersion, isLoadingRegulationVersion, regulationVersionError } =
    useRegulationVersion(regulationVersionCode)
  const { isFavorite, isLoadingFavorites, isFavoriteSaving, favoritesError, toggleFavorite } =
    useFavorites()
  const { completedCourses } = useTranscript()
  const { progressSnapshot } = useProgressSnapshot()
  const historicalLecturerLookup = useHistoricalLecturerLookup(completedCourses, periods)
  const canShowFavorites = true

  const knownPeriodLabels = useMemo(() => periods.map((period) => period.label), [periods])
  const offeringStatusByCourseId = useMemo(() => {
    const statusMap = new Map<string, OfferingStatus>()
    for (const course of courses) {
      statusMap.set(course.id, getOfferingStatus(course, knownPeriodLabels, new Date(), selectedTerms))
    }
    return statusMap
  }, [courses, knownPeriodLabels, selectedTerms])
  const cardSeasonTermTypeByCourseId = useMemo(() => {
    const termTypeMap = new Map<string, CourseTermType>()
    for (const course of courses) {
      termTypeMap.set(course.id, getCatalogCardSeasonTermType(course, knownPeriodLabels))
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

  function toggleLayout(): void {
    const next = layout === 'grid' ? 'list' : 'grid'
    setLayout(next)
    saveBrowserPreference(BROWSER_STORAGE_KEYS.catalogLayout, next)
  }

  const availableEctsValues = useMemo(
    () =>
      [...new Set(courses.map((c) => c.ects).filter((v): v is number => v !== null))].sort(
        (a, b) => a - b,
      ),
    [courses],
  )

  const topicAreaOptions = useMemo(
    () => {
      const ruleGroups = regulationVersion?.ruleGroups ?? []
      // Guests have no progress snapshot, so the whole regulation (except the
      // thesis) is the filter set. Signed-in users keep the elective chips
      // plus whatever areas are still open.
      if (!accountStudyProgramCode) {
        return buildAllSelectableRegulationAreaOptions(ruleGroups)
      }
      return buildFlexibleRegulationAreaOptions(ruleGroups)
    },
    [accountStudyProgramCode, regulationVersion?.ruleGroups],
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

  const explicitCatalogQuery =
    catalogSearch.length > 0
    || selectedStudyAreaCodes.length > 0
    || selectedEctsValues.length > 0
    || selectedDays.length > 0
    || selectedCourseTypes.length > 0
    || timeWindow.startMinutes !== null
    || timeWindow.endMinutes !== null

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
          if (!courseRanInSeasons(course, selectedTerms)) {
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
            !showUnconfirmedOfferings
            && !explicitCatalogQuery
            && offeringStatusByCourseId.get(course.id) === 'likely'
          ) {
            return false
          }
          return true
        }),
        sortOption,
      ).sort((left, right) => {
        const rank = (status: OfferingStatus | undefined): number => {
          if (status === 'unknown') return 2
          if (status === 'likely') return 1
          return 0
        }
        return rank(offeringStatusByCourseId.get(left.id)) - rank(offeringStatusByCourseId.get(right.id))
      }),
    [
      completedByCatalogCourseId,
      courses,
      explicitCatalogQuery,
      offeringStatusByCourseId,
      selectedCourseTypes,
      selectedDays,
      selectedEctsValues,
      selectedStudyAreaCodes,
      selectedTerms,
      showOnlyOpenMandatory,
      showUnconfirmedOfferings,
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

  function revealNextCatalogPage(): void {
    setPaginationState((current) => ({
      ...current,
      visibleCount: current.visibleCount + PAGE_SIZE,
    }))
  }

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = catalogScrollRef.current
    if (!sentinel || !root || !hasMore) {
      return
    }

    // The catalog scrolls inside this pane, not the window. Observing the
    // viewport never sees the sentinel cross a threshold, so the first page
    // (30 cards) stuck on "Loading more courses...".
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          revealNextCatalogPage()
        }
      },
      { root, rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, visibleCount])

  function isAreaFilterActive(code: string): boolean {
    if (accountStudyProgramCode && isMandatoryRegulationAreaCode(code, regulationRuleGroups)) {
      return showOnlyOpenMandatory
    }
    return selectedStudyAreaCodes.includes(code)
  }

  function handleAreaFilterSelect(code: string): void {
    preservedScrollTopRef.current = catalogScrollRef.current?.scrollTop ?? 0
    setAreFiltersOpen(false)
    if (accountStudyProgramCode && isMandatoryRegulationAreaCode(code, regulationRuleGroups)) {
      setShowOnlyOpenMandatory((current) => !current)
      setSelectedStudyAreaCodes([])
    } else {
      setShowOnlyOpenMandatory(false)
      setSelectedStudyAreaCodes((prev) => toggleInSelection(prev, code))
    }
  }

  function handleGuestStudyProgramChange(value: string): void {
    setSelectedStudyProgramId(value ? Number(value) : null)
    setSelectedStudyAreaCodes([])
    setShowOnlyOpenMandatory(false)
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
  const gridColsClass = layout === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'
  const firstNoDataRowIndex = visibleCatalogRows.findIndex((course) => {
    const isTourSampleRow = Boolean(
      activeCatalogSampleVariant
      && course.id === TOUR_SAMPLE_COURSES[activeCatalogSampleVariant].id,
    )
    const status = isTourSampleRow && activeCatalogSampleVariant
      ? getTourSampleOfferingStatus(activeCatalogSampleVariant)
      : offeringStatusByCourseId.get(course.id) ?? 'confirmed'
    return status === 'unknown'
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <CatalogProgressHint
        progressSnapshot={progressSnapshot}
        isAreaActive={isAreaFilterActive}
        onSelectArea={handleAreaFilterSelect}
      />
      <div
        ref={catalogScrollRef}
        data-tour-scroll-root
        className="min-h-0 min-w-0 w-full max-w-full flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-x-none overscroll-y-contain"
      >
      {/* Capped, centered content width keeps cards readable on wide screens;
          the cap applies to both the one- and two-column layouts. */}
      <div className="mx-auto w-full min-w-0 max-w-[64rem] p-4 pb-[calc(4.75rem+env(safe-area-inset-bottom,0px))] sm:p-8 sm:pt-6 sm:pb-8">

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

      {!isOnboardingOpen && studyProgramsError ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-primary">
          {studyProgramsError}
        </div>
      ) : null}

      <div className="mb-6 grid min-w-0 max-w-full gap-4 overflow-x-hidden rounded-[10px] border border-border bg-surface px-5 py-5">
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

        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2.5" data-tour="catalog-filters">
          <button
            type="button"
            onClick={() => setAreFiltersOpen((open) => !open)}
            aria-expanded={areFiltersOpen}
            className={`self-start rounded-md border px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
              hasActiveFilters
                ? 'border-primary/40 bg-primary/5 text-primary'
                : 'border-border bg-surface text-fg hover:bg-surface-hover'
            }`}
          >
            {t('catalog.filters')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''} {areFiltersOpen ? '▴' : '▾'}
          </button>

          {showGuestStudyProgram ? (
            <label className="grid min-w-0 w-full gap-1.5 sm:flex sm:w-80 sm:items-center sm:gap-2">
              <span className="text-[12px] font-semibold text-fg-muted">{t('setup.studyProgram')}</span>
              <select
                aria-label={t('setup.studyProgram')}
                value={selectedStudyProgramId ?? ''}
                disabled={isLoadingStudyPrograms}
                onChange={(event) => handleGuestStudyProgramChange(event.target.value)}
                className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none transition-colors focus:border-primary"
              >
                <option value="">{t('setup.studyProgramPlaceholder')}</option>
                {studyPrograms.map((studyProgram) => (
                  <option key={studyProgram.id} value={studyProgram.id}>{studyProgram.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="flex min-w-0 w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <label className="grid min-w-0 w-full gap-1.5 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:gap-2">
              <span className="shrink-0 text-[12px] font-semibold text-fg-muted">{t('catalog.sort')}</span>
              <select
                aria-label="Sort courses"
                value={sortOption}
                onChange={(event) => setSortOption(event.target.value as CatalogSortOption)}
                className="w-full min-w-0 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] text-fg outline-none transition-colors focus:border-primary sm:w-auto"
              >
                {Object.entries(CATALOG_SORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={toggleLayout}
              aria-label={layout === 'grid' ? 'Switch to single-column view' : 'Switch to two-column view'}
              title={layout === 'grid' ? 'Single column' : 'Two columns'}
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-fg-mid transition-colors hover:bg-surface-hover hover:text-fg md:flex"
            >
              <LayoutPreviewIcon next={layout === 'grid' ? 'list' : 'grid'} />
            </button>
          </div>
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
                  <div className="text-[12.5px] text-fg-muted">Loading regulation areas...</div>
                ) : studyProgramsError ? (
                  <div className="text-[12.5px] text-primary">{studyProgramsError}</div>
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
                    {t('catalog.topicAreasEmpty')}
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

        <label className="flex min-w-0 cursor-pointer items-center gap-2 border-t border-border-light pt-3 text-[12.5px] font-medium text-fg">
          <input
            type="checkbox"
            checked={showUnconfirmedOfferings}
            onChange={(event) => setShowUnconfirmedOfferings(event.target.checked)}
            className="h-4 w-4 shrink-0 accent-primary"
          />
          <span className="min-w-0 break-words">{t('catalog.showUnconfirmedOfferings')}</span>
        </label>
      </div>

      {!isOnboardingOpen && refreshWarning ? (
        <div className="mb-4 rounded-[10px] border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          {refreshWarning}
        </div>
      ) : null}

      {isLoading && !isOnboardingOpen && courses.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          {t('catalog.loading')}
        </div>
      ) : error && !isOnboardingOpen && courses.length === 0 ? (
        <div className="rounded-[10px] border border-border bg-surface px-8 py-15 text-center text-[13.5px] text-fg-muted">
          <p>{error}</p>
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
          <div className={`grid w-full min-w-0 max-w-full items-stretch gap-3.5 ${gridColsClass}`} data-tour="catalog-card-list">
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

              return (
                <Fragment key={isTourSampleRow ? `tour-${activeCatalogSampleVariant}` : course.id}>
                {index === firstNoDataRowIndex ? (
                  <div className="col-span-full pt-2 text-[12px] font-semibold uppercase tracking-wide text-fg-muted">
                    {t('catalog.noCurrentData')}
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
                      favoriteDisabled={isTourSampleRow || isLoadingFavorites}
                      favoriteLoading={!isTourSampleRow && isFavoriteSaving(course.id)}
                      showFavorite={canShowFavorites}
                      offeringStatus={offeringStatus}
                      studyProgramCode={studyProgramCode}
                      seasonTermType={isTourSampleRow ? course.termType : cardSeasonTermTypeByCourseId.get(course.id) ?? course.termType}
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
            <button
              type="button"
              ref={sentinelRef}
              onClick={revealNextCatalogPage}
              className="mt-6 w-full text-center text-[13px] text-fg-muted transition-colors hover:text-fg"
            >
              {t('catalog.loadingMore')}
            </button>
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
          favoriteDisabled={isLoadingFavorites}
          favoriteLoading={isFavoriteSaving(openCourseId)}
          showFavorite={canShowFavorites}
          onToggleFavorite={() => toggleFavorite(openCourseId)}
          onClose={() => navigate(catalogBasePath)}
        />
      ) : null}
    </div>
  )
}
