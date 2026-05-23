import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { ApiError } from '../../../shared/utils/api'
import { useAuth } from '../../auth'
import { fetchFavoriteCourseIds, saveFavoriteCourseIds } from '../api'
import { FavoritesContext } from '../FavoritesContext'

interface FavoritesProviderProps {
  children: ReactNode
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to synchronize favorites.'
}

export function FavoritesProvider({ children }: FavoritesProviderProps): JSX.Element {
  const { token } = useAuth()
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState<boolean>(false)
  const [isSavingFavorites, setIsSavingFavorites] = useState<boolean>(false)
  const [favoritesError, setFavoritesError] = useState<string | null>(null)

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
          setFavoritesError(normalizeErrorMessage(error))
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

  const toggleFavorite = (courseId: string): void => {
    if (!token) {
      setFavoritesError('Sign in to save favorite courses across devices.')
      return
    }

    const previousFavoriteIds = favoriteIds
    const nextFavoriteIds = favoriteIds.includes(courseId)
      ? favoriteIds.filter((id) => id !== courseId)
      : [...favoriteIds, courseId]

    setFavoriteIds(nextFavoriteIds)
    setFavoritesError(null)
    setIsSavingFavorites(true)

    void saveFavoriteCourseIds(token, nextFavoriteIds)
      .then((savedFavoriteIds) => {
        setFavoriteIds(savedFavoriteIds)
      })
      .catch((error) => {
        setFavoriteIds(previousFavoriteIds)
        setFavoritesError(normalizeErrorMessage(error))
      })
      .finally(() => {
        setIsSavingFavorites(false)
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
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  )
}
