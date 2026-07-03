import { useEffect, useMemo, useState } from 'react'
import type { CatalogPeriod, CompletedCourse } from '../types.ts'
import { fetchCatalogCourses } from '../api.ts'
import { findCatalogPeriodForSemesterLabel } from '../utils/periods.ts'
import { buildPeriodLecturerLookup, mergePeriodLecturerLookups } from '../utils/completedCourseLecturer.ts'

interface LookupState {
  cacheKey: string
  lookup: Map<string, string>
}

function buildCacheKey(periodIds: string[]): string {
  return periodIds.join('|')
}

/**
 * Loads catalog slices for semesters with completed courses so cards can show
 * the lecturer from the term the course was actually taken in.
 */
export function useHistoricalLecturerLookup(
  completedCourses: CompletedCourse[],
  periods: CatalogPeriod[],
): Map<string, string> {
  const periodIds = useMemo(() => {
    const ids = new Set<string>()
    for (const completed of completedCourses) {
      const period = findCatalogPeriodForSemesterLabel(periods, completed.semester)
      if (period) {
        ids.add(period.periodId)
      }
    }
    return [...ids].sort()
  }, [completedCourses, periods])

  const cacheKey = buildCacheKey(periodIds)
  const emptyLookup = useMemo(() => new Map<string, string>(), [])
  const [state, setState] = useState<LookupState>(() => ({
    cacheKey,
    lookup: emptyLookup,
  }))

  if (state.cacheKey !== cacheKey) {
    setState({ cacheKey, lookup: emptyLookup })
  }

  useEffect(() => {
    if (periodIds.length === 0) {
      return
    }

    let cancelled = false

    async function loadHistoricalLecturers(): Promise<void> {
      try {
        const lookups = await Promise.all(
          periodIds.map(async (periodId) => {
            const courses = await fetchCatalogCourses('', 1000, periodId)
            return buildPeriodLecturerLookup(periodId, courses)
          }),
        )
        if (cancelled) {
          return
        }
        setState((current) =>
          current.cacheKey === cacheKey
            ? { cacheKey, lookup: mergePeriodLecturerLookups(lookups) }
            : current,
        )
      } catch {
        if (!cancelled) {
          setState((current) =>
            current.cacheKey === cacheKey
              ? { cacheKey, lookup: emptyLookup }
              : current,
          )
        }
      }
    }

    void loadHistoricalLecturers()

    return () => {
      cancelled = true
    }
  }, [cacheKey, emptyLookup, periodIds])

  return periodIds.length === 0 ? emptyLookup : state.lookup
}
