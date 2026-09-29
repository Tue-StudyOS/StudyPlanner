import { useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { getErrorMessage } from '../../../shared/utils/errorMessage.ts'
import { useAuth } from '../../auth'
import { syncInterestedSemesterPlan } from '../../planner/utils/syncInterestedSemesterPlan.ts'
import { fetchFavoriteCourseIds, saveFavoriteCourseIds } from '../api'
import { FavoritesContext } from '../FavoritesContext'
import { toggleFavoriteId } from '../utils/favoriteIds.ts'
import { resolveInterestedSemester } from '../utils/interestedSemester.ts'

interface FavoritesProviderProps {
  children: ReactNode
}

export function FavoritesProvider({ children }: FavoritesProviderProps): JSX.Element {
  const { user } = useAuth()
  const { pathname, search } = useLocation()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const refreshDate = (): void => setNow(new Date())
    const timer = window.setInterval(refreshDate, 60_000)
    window.addEventListener('focus', refreshDate)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshDate)
    }
  }, [])
  const semesterLabel = resolveInterestedSemester(pathname, search, now)
  return (
    <SemesterFavoritesProvider key={`${user?.username ?? 'anonymous'}:${semesterLabel}`} semesterLabel={semesterLabel}>
      {children}
    </SemesterFavoritesProvider>
  )
}

function SemesterFavoritesProvider({
  children,
  semesterLabel,
}: FavoritesProviderProps & { semesterLabel: string }): JSX.Element {
  const { csrfToken, user } = useAuth()
  const userCacheKey = user?.username ?? 'anonymous'
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [favoriteGroups, setFavoriteGroups] = useState<string[][]>([])
  const [isLoadingFavorites, setIsLoadingFavorites] = useState<boolean>(Boolean(csrfToken))
  const [isSavingFavorites, setIsSavingFavorites] = useState<boolean>(false)
  const [favoritesError, setFavoritesError] = useState<string | null>(null)
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false)
  const isMounted = useRef(false)
  const isWriting = useRef(false)

  useEffect(() => {
    let isActive = true
    isMounted.current = true
    async function loadFavorites(): Promise<void> {
      setHasLoadedFavorites(false)
      if (!csrfToken) {
        setFavoriteIds([])
        setFavoritesError(null)
        setIsLoadingFavorites(false)
        return
      }
      setIsLoadingFavorites(true)
      setFavoritesError(null)
      try {
        const response = await fetchFavoriteCourseIds(semesterLabel)
        if (isActive) {
          setFavoriteIds(response.favoriteCourseIds)
          setFavoriteGroups(response.favoriteCourseGroups)
          setHasLoadedFavorites(true)
        }
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
      isMounted.current = false
    }
  }, [csrfToken, semesterLabel])

  const isFavorite = (courseId: string): boolean => favoriteIds.includes(courseId)
  // Whole-list PUTs must be serialized, otherwise rapid clicks lose earlier stars.
  const isFavoriteSaving = (): boolean => isLoadingFavorites || isSavingFavorites

  const toggleFavorite = (courseId: string): void => {
    if (!csrfToken) {
      setFavoritesError('Sign in to save interested courses across devices.')
      return
    }
    if (!hasLoadedFavorites || isWriting.current) {
      return
    }
    const previousFavoriteIds = favoriteIds
    const nextFavoriteIds = toggleFavoriteId(favoriteIds, courseId, favoriteGroups)
    const isAdding = !previousFavoriteIds.includes(courseId)
    isWriting.current = true
    setFavoriteIds(nextFavoriteIds)
    setFavoritesError(null)
    setIsSavingFavorites(true)

    const token = csrfToken
    async function saveFavorite(): Promise<void> {
      try {
        const response = await saveFavoriteCourseIds(token, semesterLabel, nextFavoriteIds)
        if (isMounted.current) {
          setFavoriteIds(response.favoriteCourseIds)
          setFavoriteGroups(response.favoriteCourseGroups)
        }
      } catch (error) {
        if (isMounted.current) {
          setFavoriteIds(previousFavoriteIds)
          setFavoritesError(getErrorMessage(error, 'Failed to synchronize your interested courses.'))
        }
        return
      }
      try {
        // Capture the selected semester: navigation must never redirect this
        // in-flight change into the next semester's plan.
        await syncInterestedSemesterPlan(
          token,
          userCacheKey,
          semesterLabel,
          isAdding ? [courseId] : previousFavoriteIds.filter((id) => !nextFavoriteIds.includes(id)),
          isAdding,
        )
      } catch (error) {
        if (isMounted.current) {
          setFavoritesError(`Interested saved, but the semester plan could not be updated: ${getErrorMessage(error, 'Please reload and check your plan.')}`)
        }
      }
    }
    void saveFavorite().finally(() => {
      isWriting.current = false
      if (isMounted.current) {
        setIsSavingFavorites(false)
      }
    })
  }

  return (
    <FavoritesContext.Provider
      value={{
        semesterLabel,
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
