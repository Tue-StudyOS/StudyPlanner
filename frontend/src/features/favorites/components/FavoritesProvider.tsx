import { useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { getErrorMessage } from '../../../shared/utils/errorMessage.ts'
import { useAuth } from '../../auth'
import {
  addCourseToCurrentSemesterPlan,
  pruneCurrentSemesterPlanToFavorites,
  removeCourseFromCurrentSemesterPlan,
} from '../../planner/utils/addCourseToCurrentSemesterPlan.ts'
import { fetchFavoriteCourseIds, saveFavoriteCourseIds } from '../api'
import { FavoritesContext } from '../FavoritesContext'
import { toggleFavoriteId, updateSavingFavoriteIds } from '../utils/favoriteIds.ts'

interface FavoritesProviderProps {
  children: ReactNode
}

export function FavoritesProvider({ children }: FavoritesProviderProps): JSX.Element {
  const { csrfToken, user } = useAuth()
  const userCacheKey = user?.username ?? 'anonymous'
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState<boolean>(false)
  const [savingFavoriteCourseIds, setSavingFavoriteCourseIds] = useState<string[]>([])
  const [favoritesError, setFavoritesError] = useState<string | null>(null)
  const isSavingFavorites = savingFavoriteCourseIds.length > 0
  const hasPrunedStalePlanRef = useRef(false)
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadFavorites(): Promise<void> {
      if (!csrfToken) {
        if (isActive) {
          setFavoriteIds([])
          setFavoritesError(null)
          setIsLoadingFavorites(false)
          setHasLoadedFavorites(false)
        }
        return
      }

      setIsLoadingFavorites(true)
      setFavoritesError(null)
      try {
        const nextFavoriteIds = await fetchFavoriteCourseIds()
        if (!isActive) {
          return
        }
        setFavoriteIds(nextFavoriteIds)
        setHasLoadedFavorites(true)
      } catch (error) {
        if (isActive) {
          setFavoriteIds([])
          setFavoritesError(getErrorMessage(error, 'Failed to synchronize your interested courses.'))
        }
      } finally {
        if (isActive) {
          setIsLoadingFavorites(false)
        }
      }
    }

    void loadFavorites()

    return () => {
      isActive = false
    }
  }, [csrfToken])

  useEffect(() => {
    if (!csrfToken) {
      hasPrunedStalePlanRef.current = false
      return
    }
    if (!hasLoadedFavorites || isLoadingFavorites || hasPrunedStalePlanRef.current) {
      return
    }
    hasPrunedStalePlanRef.current = true
    void pruneCurrentSemesterPlanToFavorites(csrfToken, userCacheKey, favoriteIds)
  }, [csrfToken, favoriteIds, hasLoadedFavorites, isLoadingFavorites, userCacheKey])

  const isFavorite = (courseId: string): boolean => favoriteIds.includes(courseId)
  const isFavoriteSaving = (courseId: string): boolean => savingFavoriteCourseIds.includes(courseId)

  const toggleFavorite = (courseId: string): void => {
    if (!csrfToken) {
      setFavoritesError('Sign in to save interested courses across devices.')
      return
    }
    if (savingFavoriteCourseIds.includes(courseId)) {
      return
    }

    const previousFavoriteIds = favoriteIds
    const nextFavoriteIds = toggleFavoriteId(favoriteIds, courseId)

    setFavoriteIds(nextFavoriteIds)
    setFavoritesError(null)
    setSavingFavoriteCourseIds((current) => updateSavingFavoriteIds(current, courseId, true))

    const isAddingFavorite = nextFavoriteIds.length > previousFavoriteIds.length

    void saveFavoriteCourseIds(csrfToken, nextFavoriteIds)
      .then(async (savedFavoriteIds) => {
        setFavoriteIds(savedFavoriteIds)
        if (isAddingFavorite) {
          const addedCourseId = nextFavoriteIds.find((id) => !previousFavoriteIds.includes(id))
          if (addedCourseId) {
            // addCourseToCurrentSemesterPlan marks the semester badge itself.
            await addCourseToCurrentSemesterPlan(csrfToken, userCacheKey, addedCourseId)
          }
          return
        }
        const removedCourseId = previousFavoriteIds.find((id) => !nextFavoriteIds.includes(id))
        if (removedCourseId) {
          await removeCourseFromCurrentSemesterPlan(csrfToken, userCacheKey, removedCourseId)
        }
      })
      .catch((error) => {
        setFavoriteIds(previousFavoriteIds)
        setFavoritesError(getErrorMessage(error, 'Failed to synchronize your interested courses.'))
      })
      .finally(() => {
        setSavingFavoriteCourseIds((current) => updateSavingFavoriteIds(current, courseId, false))
      })
  }

  return (
    <FavoritesContext.Provider
      value={{
        favoriteIds,
        isLoadingFavorites,
        isSavingFavorites,
        favoritesError,
        isFavorite,
        isFavoriteSaving,
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  )
}
