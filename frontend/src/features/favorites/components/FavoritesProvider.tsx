import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { getErrorMessage } from '../../../shared/utils/errorMessage.ts'
import { useAuth } from '../../auth'
import { addCourseToCurrentSemesterPlan } from '../../planner/utils/addCourseToCurrentSemesterPlan.ts'
import { fetchFavoriteCourseIds, saveFavoriteCourseIds } from '../api'
import { FavoritesContext } from '../FavoritesContext'
import { toggleFavoriteId, updateSavingFavoriteIds } from '../utils/favoriteIds.ts'

interface FavoritesProviderProps {
  children: ReactNode
}

export function FavoritesProvider({ children }: FavoritesProviderProps): JSX.Element {
  const { token, user } = useAuth()
  const userCacheKey = user?.username ?? 'anonymous'
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState<boolean>(false)
  const [savingFavoriteCourseIds, setSavingFavoriteCourseIds] = useState<string[]>([])
  const [favoritesError, setFavoritesError] = useState<string | null>(null)
  const isSavingFavorites = savingFavoriteCourseIds.length > 0

  useEffect(() => {
    let isActive = true

    async function loadFavorites(): Promise<void> {
      if (!token) {
        if (isActive) {
          setFavoriteIds([])
          setFavoritesError(null)
          setIsLoadingFavorites(false)
        }
        return
      }

      setIsLoadingFavorites(true)
      setFavoritesError(null)
      try {
        const nextFavoriteIds = await fetchFavoriteCourseIds(token)
        if (!isActive) {
          return
        }
        setFavoriteIds(nextFavoriteIds)
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
  }, [token])

  const isFavorite = (courseId: string): boolean => favoriteIds.includes(courseId)
  const isFavoriteSaving = (courseId: string): boolean => savingFavoriteCourseIds.includes(courseId)

  const toggleFavorite = (courseId: string): void => {
    if (!token) {
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

    void saveFavoriteCourseIds(token, nextFavoriteIds)
      .then(async (savedFavoriteIds) => {
        setFavoriteIds(savedFavoriteIds)
        if (isAddingFavorite) {
          const addedCourseId = nextFavoriteIds.find((id) => !previousFavoriteIds.includes(id))
          if (addedCourseId) {
            // addCourseToCurrentSemesterPlan marks the semester badge itself.
            await addCourseToCurrentSemesterPlan(token, userCacheKey, addedCourseId)
          }
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
