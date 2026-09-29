import { useEffect, useMemo, useState } from 'react'
import type { CatalogPeriod, CompletedCourse } from '../types.ts'
import { fetchCatalogLecturerIndex } from '../api.ts'
import { findCatalogPeriodForSemesterLabel } from '../utils/periods.ts'
import {
  buildLecturerLookupFromEntries,
  type CatalogLecturerEntry,
} from '../utils/completedCourseLecturer.ts'
import { readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'

const LECTURER_INDEX_CACHE_KEY = 'catalog:lecturers'

function completedPeriodKey(completedCourses: CompletedCourse[], periods: CatalogPeriod[]): string {
  const ids = new Set<string>()
  for (const completed of completedCourses) {
    const period = findCatalogPeriodForSemesterLabel(periods, completed.semester)
    if (period) {
      ids.add(period.periodId)
    }
  }
  return [...ids].sort().join('|')
}

/**
 * Lecturer from the semester a course was completed in.
 *
 * One compact index, not a full catalog download per semester. Those downloads
 * ran beside `period=all` on the catalog page and exhausted the Worker isolate;
 * the next requests, including session and config, then failed with 500.
 */
export function useHistoricalLecturerLookup(
  completedCourses: CompletedCourse[],
  periods: CatalogPeriod[],
): Map<string, string> {
  const periodKey = useMemo(
    () => completedPeriodKey(completedCourses, periods),
    [completedCourses, periods],
  )
  const emptyLookup = useMemo(() => new Map<string, string>(), [])
  const [lookup, setLookup] = useState<Map<string, string>>(emptyLookup)

  useEffect(() => {
    if (!periodKey) {
      return
    }

    let cancelled = false

    async function loadLecturers(): Promise<void> {
      try {
        const cached = readSessionCache<CatalogLecturerEntry[]>(LECTURER_INDEX_CACHE_KEY)
        const entries = cached ?? (await fetchCatalogLecturerIndex())
        if (!cached) {
          writeSessionCache(LECTURER_INDEX_CACHE_KEY, entries)
        }
        if (cancelled) {
          return
        }
        setLookup(buildLecturerLookupFromEntries(entries))
      } catch {
        if (!cancelled) {
          setLookup(emptyLookup)
        }
      }
    }

    void loadLecturers()

    return () => {
      cancelled = true
    }
  }, [emptyLookup, periodKey])

  return periodKey ? lookup : emptyLookup
}
