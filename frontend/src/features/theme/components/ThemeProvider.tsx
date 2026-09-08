import { useEffect, useState } from 'react'
import type { ReactNode, JSX } from 'react'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { ThemeContext } from '../ThemeContext'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(BROWSER_STORAGE_KEYS.theme) === 'dark'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem(BROWSER_STORAGE_KEYS.theme, isDark ? 'dark' : 'light')
    } catch {
      // The selected theme remains active in memory when storage is unavailable.
    }
  }, [isDark])

  const toggleTheme = (): void => setIsDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
