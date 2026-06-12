import { useEffect, useState } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { readSessionCache, writeSessionCache } from '../../../shared/utils/sessionCache.ts'
import { useAuth } from '../../auth'
import { useTranscript } from '../../transcript'
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
  const { token, user } = useAuth()
  const userCacheKey = user?.username ?? 'anonymous'
  const { completedCourses, isLoadingCompletedCourses } = useTranscript()
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

      if (isLoadingCompletedCourses) {
        if (isActive) {
          setIsLoadingProgress(true)
          setProgressError(null)
        }
        return
      }

      const cachedSnapshot = readSessionCache<ProgressSnapshot>('private:progress:snapshot', userCacheKey)
      if (cachedSnapshot) {
        setProgressSnapshot(cachedSnapshot)
      }
      setIsLoadingProgress(!cachedSnapshot)
      setProgressError(null)
      try {
        const snapshot = await fetchProgressSnapshot(token)
        if (!isActive) {
          return
        }
        writeSessionCache('private:progress:snapshot', snapshot, userCacheKey)
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
  }, [completedCourses, isLoadingCompletedCourses, token, userCacheKey])

  return { progressSnapshot, isLoadingProgress, progressError }
}
