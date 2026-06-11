import { useEffect, useState } from 'react'
import { fetchCatalogPeriods } from '../api'
import type { CatalogPeriod } from '../types'

export function useCatalogPeriods(): {
  periods: CatalogPeriod[]
  isLoadingPeriods: boolean
  periodsError: string | null
} {
  const [periods, setPeriods] = useState<CatalogPeriod[]>([])
  const [isLoadingPeriods, setIsLoadingPeriods] = useState<boolean>(true)
  const [periodsError, setPeriodsError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadPeriods(): Promise<void> {
      setIsLoadingPeriods(true)
      setPeriodsError(null)
      try {
        const nextPeriods = await fetchCatalogPeriods()
        if (!isActive) {
          return
        }
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
