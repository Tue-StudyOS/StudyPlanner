import { useEffect, useState } from 'react'
import type { ReactNode, JSX } from 'react'
import { ThemeContext } from '../ThemeContext'

const STORAGE_KEY = 'theme'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [isDark, setIsDark] = useState<boolean>(() => localStorage.getItem(STORAGE_KEY) === 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light')
  }, [isDark])

  const toggleTheme = (): void => setIsDark(prev => !prev)

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
