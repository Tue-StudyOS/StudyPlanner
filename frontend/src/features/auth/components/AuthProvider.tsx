import { useEffect, useMemo, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { AuthContext } from '../AuthContext'
import type { LoginInput, RegisterInput, SaveProfileInput } from '../AuthContext'
import {
  fetchCurrentSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveCurrentProfile,
} from '../api'
import type { AuthUser } from '../types'

const STORAGE_KEY = 'studyplaner.auth.token'

function loadStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function persistToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token)
      return
    }
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore storage failures; the in-memory session still works for the current tab.
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [token, setToken] = useState<string | null>(loadStoredToken)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true)

  useEffect(() => {
    let isActive = true

    async function restoreSession(): Promise<void> {
      if (!token) {
        if (isActive) {
          setUser(null)
          setIsLoadingSession(false)
        }
        return
      }

      try {
        const session = await fetchCurrentSession(token)
        if (!isActive) {
          return
        }
        if (!session.authenticated || !session.user) {
          persistToken(null)
          setToken(null)
          setUser(null)
        } else {
          setUser(session.user)
        }
      } catch {
        if (!isActive) {
          return
        }
        persistToken(null)
        setToken(null)
        setUser(null)
      } finally {
        if (isActive) {
          setIsLoadingSession(false)
        }
      }
    }

    void restoreSession()

    return () => {
      isActive = false
    }
  }, [token])

  async function register(input: RegisterInput): Promise<void> {
    const authPayload = await registerAccount(input)
    persistToken(authPayload.token)
    setToken(authPayload.token)
    setUser(authPayload.user)
  }

  async function login(input: LoginInput): Promise<void> {
    const authPayload = await loginAccount(input)
    persistToken(authPayload.token)
    setToken(authPayload.token)
    setUser(authPayload.user)
  }

  async function logout(): Promise<void> {
    if (token) {
      try {
        await logoutAccount(token)
      } catch {
        // Logging out locally is still better than keeping a broken client session.
      }
    }

    persistToken(null)
    setToken(null)
    setUser(null)
  }

  async function saveProfile(input: SaveProfileInput): Promise<void> {
    if (!token) {
      throw new Error('You must be signed in to update your profile.')
    }
    const updatedUser = await saveCurrentProfile(token, input)
    setUser(updatedUser)
  }

  const contextValue = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: user !== null,
      isLoadingSession,
      register,
      login,
      logout,
      saveProfile,
    }),
    [isLoadingSession, token, user],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
