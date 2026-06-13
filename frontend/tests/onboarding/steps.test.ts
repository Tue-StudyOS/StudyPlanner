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
  assert.equal(finalStep?.preserveScroll, true)
})

test('example card steps highlight the tour sample cards sorted into the catalog', () => {
  const confirmed = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card')
  const likely = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card-likely')
  const unknown = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-card-unknown')

  assert.equal(confirmed?.sample, 'confirmed')
  assert.equal(confirmed?.preserveScroll, true)
  assert.equal(confirmed?.allowMobileScroll, true)
  assert.equal(confirmed?.mobileTargetTopOffsetPx, 144)
  assert.deepEqual(confirmed?.targets, ['catalog-sample-confirmed'])
  assert.equal(likely?.sample, 'likely')
  assert.equal(likely?.preserveScroll, true)
  assert.equal(likely?.allowMobileScroll, true)
  assert.equal(likely?.mobileTargetTopOffsetPx, 144)
  assert.deepEqual(likely?.targets, ['catalog-sample-likely'])
  assert.equal(unknown?.sample, 'unknown')
  assert.equal(unknown?.preserveScroll, true)
  assert.equal(unknown?.allowMobileScroll, true)
  assert.equal(unknown?.mobileTargetTopOffsetPx, 144)
  assert.deepEqual(unknown?.targets, ['catalog-sample-unknown'])
})

test('catalog setup steps keep mobile targets reachable and explain open degree areas', () => {
  const search = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-search')
  const filters = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-filters')
  const progressHint = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'catalog-progress-hint')

  assert.equal(search?.preserveScroll, true)
  assert.equal(search?.resetScroll, true)
  assert.equal(search?.allowMobileScroll, undefined)
  assert.equal(filters?.preserveScroll, true)
  assert.equal(filters?.allowMobileScroll, undefined)
  assert.deepEqual(progressHint?.targets, ['catalog-progress-hint'])
  assert.equal(progressHint?.spotlightPaddingPx, 0)
})

test('transcript starts at the top on desktop while mobile may reposition the upload card', () => {
  const transcript = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'transcript')

  assert.equal(transcript?.preserveScroll, true)
  assert.equal(transcript?.resetScroll, true)
  assert.equal(transcript?.allowMobileScroll, true)
})

test('planner steps keep the page stable and add one mobile-only add button step', () => {
  const grid = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'planner-grid')
  const mobileAddButton = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'planner-mobile-add-button')
  const mobileAdd = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'planner-add-mobile')
  const desktopAdd = TOUR_STEP_DEFINITIONS.find((step) => step.id === 'planner-add-desktop')

  assert.equal(grid?.resetScroll, true)
  assert.equal(grid?.preserveScroll, true)
  assert.equal(grid?.allowMobileScroll, true)
  assert.equal(mobileAddButton?.viewport, 'mobile')
  assert.deepEqual(mobileAddButton?.targets, ['planner-add'])
  assert.equal(mobileAddButton?.resetScroll, true)
  assert.equal(mobileAddButton?.allowMobileScroll, true)
  assert.equal(mobileAdd?.viewport, 'mobile')
  assert.equal(mobileAdd?.preserveScroll, true)
  assert.deepEqual(mobileAdd?.targets, ['planner-interested-card', 'planner-interested'])
  assert.equal(desktopAdd?.viewport, 'desktop')
  assert.equal(desktopAdd?.preserveScroll, true)
  assert.deepEqual(desktopAdd?.targets, ['planner-interested-card', 'planner-interested'])
})

test('buildTourSteps resolves labels without adding auto-advance metadata', () => {
  const steps = buildTourSteps(keyTranslator)
  const welcomeStep = steps[0]

  assert.equal(welcomeStep.title, 'tour.welcome.title')
  assert.equal(welcomeStep.body, 'tour.welcome.body')
  assert.equal(steps.find((step) => step.id === 'progress')?.title, 'nav.progress - tour.progress.title')
  assert.equal(steps.find((step) => step.id === 'reopen-guide')?.title, 'tour.reopen.title')
  assert.equal('durationMs' in welcomeStep, false)
  assert.equal('autoAdvance' in welcomeStep, false)
})
