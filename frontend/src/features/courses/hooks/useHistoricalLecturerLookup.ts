import { useEffect, useMemo, useState } from 'react'
import type { CatalogPeriod, CompletedCourse } from '../types.ts'
import { fetchCatalogCourses } from '../api.ts'
import { findCatalogPeriodForSemesterLabel } from '../utils/periods.ts'
import { buildPeriodLecturerLookup, mergePeriodLecturerLookups } from '../utils/completedCourseLecturer.ts'
import { mapWithConcurrency } from '../../../shared/utils/mapWithConcurrency.ts'

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
        // Bounded rather than Promise.all: each period returns ~1.43 MB, and
        // requesting all of them at once put ~10 MB of concurrent response
        // bodies into a single backend isolate, which hung it and every later
        // request on the same connection. Two in flight is ~2.9 MB, under the
        // ~4 MB measured threshold. See docs/load-test-2026-08.md.
        const lookups = await mapWithConcurrency(periodIds, 2, async (periodId) => {
          const courses = await fetchCatalogCourses('', 1000, periodId)
          return buildPeriodLecturerLookup(periodId, courses)
        })
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
