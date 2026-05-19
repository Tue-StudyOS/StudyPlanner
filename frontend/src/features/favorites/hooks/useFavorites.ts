import { useContext } from 'react'
import { FavoritesContext, type FavoritesContextValue } from '../FavoritesContext'

export function useFavorites(): FavoritesContextValue {
  const context = useContext(FavoritesContext)
  if (!context) throw new Error('useFavorites must be used within FavoritesProvider')
  return context
}
