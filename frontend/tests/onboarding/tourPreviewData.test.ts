import assert from 'node:assert/strict'
import test from 'node:test'
import {
  TOUR_CATALOG_SAMPLE_VARIANTS,
  TOUR_PLANNER_PLANNED_COURSES,
  TOUR_SAMPLE_COURSES,
  TOUR_TRANSCRIPT_COMPLETED_COURSES,
  TOUR_TRANSCRIPT_IMPORT_CANDIDATES,
  buildTourPlannerPreview,
  getCatalogTourSampleVariant,
  getTourCatalogSampleTarget,
  isCatalogCardTourStep,
  isPlannerTourStep,
  isTranscriptTourStep,
} from '../../src/features/onboarding/utils/tourPreviewData.ts'

test('catalog tour sample helpers expose stable top-card targets', () => {
  assert.deepEqual(TOUR_CATALOG_SAMPLE_VARIANTS, ['confirmed', 'likely', 'unknown'])
  assert.equal(getTourCatalogSampleTarget('confirmed'), 'catalog-sample-confirmed')
  assert.equal(getCatalogTourSampleVariant('catalog-card-likely'), 'likely')
  assert.equal(getCatalogTourSampleVariant('catalog-search'), null)
  assert.equal(isCatalogCardTourStep('catalog-card-likely'), true)
  assert.equal(isCatalogCardTourStep('catalog-search'), false)
})

test('tour sample courses are realistic but clearly mock-only', () => {
  assert.equal(TOUR_SAMPLE_COURSES.confirmed.lecturer, 'Max Mustermann')
  assert.equal(TOUR_SAMPLE_COURSES.unknown.lecturer, 'Emre Sözbilir')
  assert.match(TOUR_SAMPLE_COURSES.unknown.description, /intentionally not offered/i)
})

test('planner tour preview includes scheduled and unscheduled dummy courses', () => {
  assert.equal(isPlannerTourStep('planner-grid'), true)
  assert.equal(isPlannerTourStep('catalog-card'), false)
  assert.ok(TOUR_PLANNER_PLANNED_COURSES.some((course) => course.schedule.length > 0))
  assert.ok(TOUR_PLANNER_PLANNED_COURSES.some((course) => course.schedule.length === 0))
})

test('planner tour preview follows the selected regulation rule groups', () => {
  const preview = buildTourPlannerPreview([
    { code: 'ML-FOUND', name: 'Foundations', groupType: 'pflicht', requiredEcts: 24 },
    { code: 'ML-DIVERSE', name: 'Diverse Areas', groupType: 'elective_area', requiredEcts: 18 },
  ], 'ML')

  assert.deepEqual(preview.ruleGroups.map((group) => group.code), ['ML-FOUND', 'ML-DIVERSE'])
  assert.equal(preview.completedCourses[0]?.studyAreaCode, 'ML-FOUND')
  assert.equal(preview.assignments['tour-planner-overlap'], 'ML-DIVERSE')
})

test('transcript tour preview uses mock rows instead of personal data', () => {
  assert.equal(isTranscriptTourStep('transcript'), true)
  assert.equal(isTranscriptTourStep('catalog-search'), false)
  assert.equal(TOUR_TRANSCRIPT_IMPORT_CANDIDATES[0]?.title, 'Algorithms for Breakfast Logistics')
  assert.equal(TOUR_TRANSCRIPT_COMPLETED_COURSES[0]?.source, 'tour_preview')
})
