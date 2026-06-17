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
  // Completeness depends only on the program and start semester the user picked.
  // The UI always resolves a language (persisted value → browser → English), so
  // appLanguage must NOT gate setup: requiring it kept the "Set up your studies"
  // dialog open whenever the backend omitted the field — e.g. a backend deploy
  // predating appLanguage, or older accounts — even after a successful save.
  return Boolean(
    profile
      && profile.studyProgramId !== null
      && profile.currentSemesterLabel
      && profile.currentSemesterLabel.trim().length > 0,
  )
}

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  return value === 'en' || value === 'de'
}
