import { useEffect, useState } from 'react'
import type { ReactNode, JSX } from 'react'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { saveBrowserPreference } from '../../../shared/utils/browserPreferences.ts'
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
  }, [isDark])

  const toggleTheme = (): void => {
    const next = !isDark
    setIsDark(next)
    saveBrowserPreference(BROWSER_STORAGE_KEYS.theme, next ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
