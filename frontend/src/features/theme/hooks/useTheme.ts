import { useContext } from 'react'
import { ThemeContext, type ThemeContextType } from '../ThemeContext'

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}
