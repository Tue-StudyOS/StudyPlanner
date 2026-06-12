import { useEffect, useState } from 'react'
import { readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'
import { fetchCatalogPeriods } from '../api'
import type { CatalogPeriod } from '../types'

const CACHE_KEY = 'catalog:periods'

export function useCatalogPeriods(): {
  periods: CatalogPeriod[]
  isLoadingPeriods: boolean
  periodsError: string | null
} {
  const cachedPeriods = readSessionCache<CatalogPeriod[]>(CACHE_KEY)
  const [periods, setPeriods] = useState<CatalogPeriod[]>(cachedPeriods ?? [])
  const [isLoadingPeriods, setIsLoadingPeriods] = useState<boolean>(!cachedPeriods)
  const [periodsError, setPeriodsError] = useState<string | null>(null)

  useEffect(() => {
    if (readSessionCache<CatalogPeriod[]>(CACHE_KEY)) {
      return
    }

    let isActive = true

    async function loadPeriods(): Promise<void> {
      setIsLoadingPeriods(true)
      setPeriodsError(null)
      try {
        const nextPeriods = await fetchCatalogPeriods()
        if (!isActive) {
          return
        }
        writeSessionCache(CACHE_KEY, nextPeriods)
        setPeriods(nextPeriods)
      } catch (loadError) {
        if (!isActive) {
          return
        }
        const message =
          loadError instanceof Error ? loadError.message : 'Failed to load catalog semesters.'
        setPeriodsError(message)
      } finally {
        if (isActive) {
          setIsLoadingPeriods(false)
        }
      }
    }

    void loadPeriods()

    return () => {
      isActive = false
    }
  }, [])

  return { periods, isLoadingPeriods, periodsError }
}
