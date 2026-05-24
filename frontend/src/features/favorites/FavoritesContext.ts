import { createContext } from 'react'

export interface FavoritesContextValue {
  favoriteIds: string[]
  isLoadingFavorites: boolean
  isSavingFavorites: boolean
  favoritesError: string | null
  isFavorite: (courseId: string) => boolean
  toggleFavorite: (courseId: string) => void
}

export const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined)
