import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { BROWSER_STORAGE_KEYS } from '../../../shared/utils/browserStorageRegistry.ts'
import { clearPrivateBrowserData } from '../../../shared/utils/privateBrowserData.ts'
import { AuthContext } from '../AuthContext'
import type {
  DeleteAccountInput,
  LoginInput,
  RegisterInput,
  SaveProfileInput,
  UpdateCredentialsInput,
} from '../AuthContext'
import {
  deleteAccountRequest,
  fetchCurrentSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  saveCurrentProfile,
  updateCredentials as updateCredentialsApi,
} from '../api'
import type { AuthUser } from '../types'

function loadLegacyBearerToken(): string | null {
  try {
    return localStorage.getItem(BROWSER_STORAGE_KEYS.legacyAuthToken)
  } catch {
    return null
  }
}

function clearLegacyBearerToken(): void {
  try {
    localStorage.removeItem(BROWSER_STORAGE_KEYS.legacyAuthToken)
  } catch {
    // Browser storage can be unavailable in private or hardened contexts.
  }
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps): JSX.Element {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true)

  useEffect(() => {
    let isActive = true

    async function restoreSession(): Promise<void> {
      const legacyBearerToken = loadLegacyBearerToken()
      try {
        const session = await fetchCurrentSession(legacyBearerToken)
        if (!isActive) {
          return
        }
        if (session.authenticated && session.user && session.csrfToken) {
          setCsrfToken(session.csrfToken)
          setUser(session.user)
        } else {
          setCsrfToken(null)
          setUser(null)
        }
      } catch {
        if (!isActive) {
          return
        }
        setCsrfToken(null)
        setUser(null)
      } finally {
        // A valid legacy bearer token is promoted to the HttpOnly cookie by
        // /api/auth/session. Invalid and expired tokens must not remain readable.
        clearLegacyBearerToken()
        if (isActive) {
          setIsLoadingSession(false)
        }
      }
    }

    void restoreSession()

    return () => {
      isActive = false
    }
  }, [])

  const register = useCallback(async (input: RegisterInput): Promise<void> => {
    const authPayload = await registerAccount(input)
    setCsrfToken(authPayload.csrfToken)
    setUser(authPayload.user)
  }, [])

  const login = useCallback(async (input: LoginInput): Promise<void> => {
    const authPayload = await loginAccount(input)
    setCsrfToken(authPayload.csrfToken)
    setUser(authPayload.user)
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    const username = user?.username
    if (csrfToken) {
      try {
        await logoutAccount(csrfToken)
      } catch {
        // Clearing local UI state is still safer than retaining a broken session.
      }
    }

    clearLegacyBearerToken()
    if (username) {
      clearPrivateBrowserData(username)
    }
    setCsrfToken(null)
    setUser(null)
  }, [csrfToken, user?.username])

  const saveProfile = useCallback(async (input: SaveProfileInput): Promise<void> => {
    if (!csrfToken) {
      throw new Error('You must be signed in to update your profile.')
    }
    const updatedUser = await saveCurrentProfile(csrfToken, input)
    setUser(updatedUser)
  }, [csrfToken])

  const updateCredentials = useCallback(async (input: UpdateCredentialsInput): Promise<void> => {
    if (!csrfToken) {
      throw new Error('You must be signed in to update your credentials.')
    }
    const updatedSession = await updateCredentialsApi(csrfToken, input)
    setCsrfToken(updatedSession.csrfToken)
    setUser(updatedSession.user)
  }, [csrfToken])

  const deleteAccount = useCallback(async (input: DeleteAccountInput): Promise<void> => {
    if (!csrfToken || !user) {
      throw new Error('You must be signed in to delete your account.')
    }
    const username = user.username
    await deleteAccountRequest(csrfToken, input)
    clearLegacyBearerToken()
    clearPrivateBrowserData(username)
    setCsrfToken(null)
    setUser(null)
  }, [csrfToken, user])

  const contextValue = useMemo(
    () => ({
      user,
      csrfToken,
      isAuthenticated: user !== null,
      isLoadingSession,
      register,
      login,
      logout,
      saveProfile,
      updateCredentials,
      deleteAccount,
    }),
    [csrfToken, deleteAccount, isLoadingSession, login, logout, register, saveProfile, updateCredentials, user],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
