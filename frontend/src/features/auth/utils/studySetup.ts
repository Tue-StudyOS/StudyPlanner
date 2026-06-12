import type { SupportedLanguage } from '../../i18n'
import {
  buildSemesterOptions,
  getCurrentSemesterLabel,
  getRelativeSemesterLabel,
} from '../../planner/utils/semesterLabels.ts'
import type { AuthProfile } from '../types'

const EARLIEST_SEMESTER = 'WS 2021/22'

export function generateStartSemesters(): string[] {
  const currentSemesterLabel = getCurrentSemesterLabel()
  return buildSemesterOptions(
    [],
    currentSemesterLabel,
    EARLIEST_SEMESTER,
    getRelativeSemesterLabel(currentSemesterLabel, 1),
  ).reverse()
}

export function isStudySetupComplete(profile: AuthProfile | null | undefined): boolean {
  return Boolean(
    profile?.appLanguage
      && profile.studyProgramId !== null
      && profile.currentSemesterLabel
      && profile.currentSemesterLabel.trim().length > 0,
  )
}

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === 'en' || value === 'de'
}
