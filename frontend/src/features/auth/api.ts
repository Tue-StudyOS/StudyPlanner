import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type { SupportedLanguage } from '../i18n'
import type { AuthPayload, AuthSessionResponse, AuthUser, StudyProgramOption } from './types'

interface RegisterInput {
  identifier: string
  password: string
  studyProgramId?: number | null
  currentSemesterLabel?: string | null
  appLanguage?: SupportedLanguage | null
}

interface LoginInput {
  identifier: string
  password: string
}

interface StudyProgramsResponse {
  studyPrograms: StudyProgramOption[]
}

interface UserResponse {
  user: AuthUser
}

interface SaveProfileInput {
  studyProgramId: number | null
  currentSemesterLabel: string | null
  plannerMobileLayout?: 'compact-grid' | 'weekly-list'
  appLanguage?: SupportedLanguage | null
  onboardingTourCompleted?: boolean
}

interface UpdateCredentialsInput {
  currentPassword: string
  identifier?: string
  newPassword?: string
}

function isSupportedStudyProgram(studyProgram: StudyProgramOption): boolean {
  return studyProgram.sourceStatus === 'official'
    && studyProgram.poVersion === '2021'
    && studyProgram.defaultRegulationVersionLabel === '2021'
}

export async function registerAccount(input: RegisterInput): Promise<AuthPayload> {
  return await fetchJson<AuthPayload>('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export async function loginAccount(input: LoginInput): Promise<AuthPayload> {
  return await fetchJson<AuthPayload>('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export async function logoutAccount(token: string): Promise<void> {
  await fetchJson<void>('/api/auth/logout', {
    method: 'POST',
    headers: {
      ...createAuthHeaders(token),
    },
  })
}

export async function fetchCurrentSession(token: string): Promise<AuthSessionResponse> {
  return await fetchJson<AuthSessionResponse>('/api/auth/session', {
    headers: {
      ...createAuthHeaders(token),
    },
  })
}

export async function saveCurrentProfile(
  token: string,
  input: SaveProfileInput,
): Promise<AuthUser> {
  const response = await fetchJson<UserResponse>('/api/me/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify(input),
  })
  return response.user
}

export async function updateCredentials(
  token: string,
  input: UpdateCredentialsInput,
): Promise<AuthUser> {
  const response = await fetchJson<UserResponse>('/api/me/credentials', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...createAuthHeaders(token),
    },
    body: JSON.stringify(input),
  })
  return response.user
}

export async function fetchStudyPrograms(): Promise<StudyProgramOption[]> {
  const response = await fetchJson<StudyProgramsResponse>('/api/study-programs')
  return response.studyPrograms
    .filter(isSupportedStudyProgram)
    .sort((left, right) => left.name.localeCompare(right.name))
}

