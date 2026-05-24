import { useEffect, useState } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { useAuth } from '../../auth'
import { fetchProgressSnapshot } from '../api'
import type { ProgressSnapshot } from '../types'

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to load progress data.'
}

export function useProgressSnapshot(): {
  progressSnapshot: ProgressSnapshot | null
  isLoadingProgress: boolean
  progressError: string | null
} {
  const { token } = useAuth()
  const [progressSnapshot, setProgressSnapshot] = useState<ProgressSnapshot | null>(null)
  const [isLoadingProgress, setIsLoadingProgress] = useState<boolean>(false)
  const [progressError, setProgressError] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true

    async function loadProgressSnapshot(): Promise<void> {
      if (!token) {
        if (isActive) {
          setProgressSnapshot(null)
          setProgressError(null)
          setIsLoadingProgress(false)
        }
        return
      }

      setIsLoadingProgress(true)
      setProgressError(null)
      try {
        const snapshot = await fetchProgressSnapshot(token)
        if (!isActive) {
          return
        }
        setProgressSnapshot(snapshot)
      } catch (error) {
        if (!isActive) {
          return
        }
        setProgressSnapshot(null)
        setProgressError(normalizeErrorMessage(error))
      } finally {
        if (isActive) {
          setIsLoadingProgress(false)
        }
      }
    }

    void loadProgressSnapshot()

    return () => {
      isActive = false
    }
  }, [token])

  return { progressSnapshot, isLoadingProgress, progressError }
}
