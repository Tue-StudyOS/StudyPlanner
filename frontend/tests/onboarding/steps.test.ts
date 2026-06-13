import assert from 'node:assert/strict'
import test from 'node:test'
import { ROUTES } from '../../src/features/routes.ts'
import { TOUR_STEP_DEFINITIONS, buildTourSteps } from '../../src/features/onboarding/steps.ts'
import type { TranslationKey } from '../../src/features/i18n/translations.ts'

const keyTranslator = (key: TranslationKey): string => key

test('tour starts with a static welcome step before navigating through product pages', () => {
  assert.equal(TOUR_STEP_DEFINITIONS[0].id, 'welcome')
  assert.equal(TOUR_STEP_DEFINITIONS[0].route, undefined)
  assert.equal(TOUR_STEP_DEFINITIONS[1].route, ROUTES.transcript)
})

test('tour includes a final catalog step that highlights the reopen button', () => {
  const finalStep = TOUR_STEP_DEFINITIONS.at(-1)

  assert.equal(finalStep?.id, 'reopen-guide')
  assert.equal(finalStep?.route, ROUTES.catalog)
  assert.deepEqual(finalStep?.targets, ['reopen-tour'])
})

test('example card steps render self-contained samples instead of targeting live data', () => {
  const confirmed = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card')
  const likely = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card-likely')
  const unknown = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card-unknown')

  assert.equal(confirmed?.sample, 'confirmed')
  assert.equal(confirmed?.targets, undefined)
  assert.equal(likely?.sample, 'likely')
  assert.equal(likely?.targets, undefined)
  assert.equal(unknown?.sample, 'unknown')
  assert.equal(unknown?.targets, undefined)
})

test('buildTourSteps resolves labels without adding auto-advance metadata', () => {
  const steps = buildTourSteps(keyTranslator)
  const welcomeStep = steps[0]

  assert.equal(welcomeStep.title, 'tour.welcome.title')
  assert.equal(welcomeStep.body, 'tour.welcome.body')
  assert.equal('durationMs' in welcomeStep, false)
  assert.equal('autoAdvance' in welcomeStep, false)
})
