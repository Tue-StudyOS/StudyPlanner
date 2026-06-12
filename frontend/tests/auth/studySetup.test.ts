import assert from 'node:assert/strict'
import test from 'node:test'
import type { AuthProfile } from '../../src/features/auth/types.ts'
import { isStudySetupComplete } from '../../src/features/auth/utils/studySetup.ts'

function profile(overrides: Partial<AuthProfile> = {}): AuthProfile {
  return {
    currentSemesterLabel: 'SS 2026',
    studyProgramId: 1,
    studyProgramCode: 'bsc_info_2021',
    studyProgramName: 'B.Sc. Informatik',
    regulationVersionId: 1,
    regulationVersionCode: 'bsc_info_2021',
    regulationVersionLabel: '2021',
    regulationCode: 'bsc_info',
    regulationName: 'B.Sc. Informatik',
    plannerMobileLayout: 'compact-grid',
    appLanguage: 'en',
    onboardingTourCompleted: false,
    totalEcts: 180,
    ...overrides,
  }
}

test('isStudySetupComplete requires language, study program, and start semester', () => {
  assert.equal(isStudySetupComplete(profile()), true)
  assert.equal(isStudySetupComplete(profile({ appLanguage: null })), false)
  assert.equal(isStudySetupComplete(profile({ studyProgramId: null })), false)
  assert.equal(isStudySetupComplete(profile({ currentSemesterLabel: '' })), false)
  assert.equal(isStudySetupComplete(profile({ currentSemesterLabel: '   ' })), false)
})

test('isStudySetupComplete treats missing profiles as incomplete', () => {
  assert.equal(isStudySetupComplete(null), false)
  assert.equal(isStudySetupComplete(undefined), false)
})
