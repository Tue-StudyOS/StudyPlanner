import { createContext } from 'react'
import type { AuthUser } from './types'

export interface RegisterInput {
  identifier: string
  password: string
  studyProgramId?: number | null
  currentSemesterLabel?: string | null
}

export interface LoginInput {
  identifier: string
  password: string
}

export interface SaveProfileInput {
  studyProgramId: number | null
  currentSemesterLabel: string | null
  plannerMobileMode: 'auto' | 'mobile' | 'desktop'
  plannerMobileLayout: 'compact-grid' | 'weekly-list'
}

export interface UpdateCredentialsInput {
  currentPassword: string
  identifier?: string
  newPassword?: string
}

export interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoadingSession: boolean
  register: (input: RegisterInput) => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
  saveProfile: (input: SaveProfileInput) => Promise<void>
  updateCredentials: (input: UpdateCredentialsInput) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
