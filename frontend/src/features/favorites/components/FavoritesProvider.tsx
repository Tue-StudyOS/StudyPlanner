import { useEffect, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { FavoritesContext } from '../FavoritesContext'

const STORAGE_KEY = 'favorites'

function loadFavorites(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

interface FavoritesProviderProps {
  children: ReactNode
}

export function FavoritesProvider({ children }: FavoritesProviderProps): JSX.Element {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(loadFavorites)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds))
  }, [favoriteIds])

  const isFavorite = (courseId: string): boolean => favoriteIds.includes(courseId)

  const toggleFavorite = (courseId: string): void => {
    setFavoriteIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    )
  }

  return (
    <FavoritesContext.Provider value={{ favoriteIds, isFavorite, toggleFavorite }}>
      {children}
    </FavoritesContext.Provider>
  )
}
