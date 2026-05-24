export interface AuthProfile {
  currentSemesterLabel: string | null
  studyProgramId: number | null
  studyProgramCode: string | null
  studyProgramName: string | null
  regulationVersionId: number | null
  regulationVersionCode: string | null
  regulationVersionLabel: string | null
  regulationCode: string | null
  regulationName: string | null
  totalEcts?: number | null
}

export interface AuthUser {
  id: number
  email: string
  displayName: string
  profile: AuthProfile
}

export interface AuthPayload {
  token: string
  user: AuthUser
}

export interface StudyProgramOption {
  id: number
  code: string
  name: string
  degree: string | null
  subject: string | null
  poVersion: string | null
  totalEcts: number | null
  language: string | null
  sourceStatus: string
  notes: string | null
  defaultRegulationVersionCode: string | null
  defaultRegulationVersionLabel: string | null
  defaultRegulationCode: string | null
  defaultRegulationName: string | null
  enrollmentMatch: string | null
  regulationVersionCount: number
}

export interface AuthSessionResponse {
  authenticated: boolean
  user: AuthUser | null
}
