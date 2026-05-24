import { createAuthHeaders, fetchJson } from '../../shared/utils/api'
import type {
  AuthPayload,
  AuthSessionResponse,
  AuthUser,
  RegulationVersionOption,
  StudyProgramOption,
} from './types'

interface RegisterInput {
  identifier: string
  password: string
}

interface LoginInput {
  identifier: string
  password: string
}

interface StudyProgramsResponse {
  studyPrograms: StudyProgramOption[]
}

interface RegulationVersionsResponse {
  regulationVersions: RegulationVersionOption[]
}

interface UserResponse {
  user: AuthUser
}

interface SaveProfileInput {
  studyProgramId: number | null
  regulationVersionId: number | null
  currentSemesterLabel: string | null
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

export async function fetchStudyPrograms(): Promise<StudyProgramOption[]> {
  const response = await fetchJson<StudyProgramsResponse>('/api/study-programs')
  return response.studyPrograms
}

export async function fetchRegulationVersions(): Promise<RegulationVersionOption[]> {
  const response = await fetchJson<RegulationVersionsResponse>('/api/regulation-versions')
  return response.regulationVersions
}
