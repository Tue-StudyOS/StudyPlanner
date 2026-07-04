import assert from 'node:assert/strict'
import test from 'node:test'
import { getCatalogSeasonGlyphPresentation } from '../../src/features/courses/utils/catalogSeasonGlyphPresentation.ts'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

test('getCatalogSeasonGlyphPresentation maps comparison tiers', () => {
  assert.deepEqual(getCatalogSeasonGlyphPresentation(0), { size: 'small', tone: 'muted' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(5), { size: 'small', tone: 'muted' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(6), { size: 'small', tone: 'seasonal' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(11), { size: 'small', tone: 'seasonal' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(12), { size: 'large', tone: 'muted' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(17), { size: 'large', tone: 'muted' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(18), { size: 'large', tone: 'seasonal' })
})

test('courseMatchesStudyAreaFilter requires every selected area', () => {
  const course = {
    studyAreaOptions: [
      { studyAreaCode: 'INFO', studyAreaName: 'Info', programCode: 'INF', optionStatus: 'active' },
      { studyAreaCode: 'PRAK', studyAreaName: 'Practical', programCode: 'INF', optionStatus: 'active' },
    ],
  }

  assert.equal(courseMatchesStudyAreaFilter(course, [], 'INF'), true)
  assert.equal(courseMatchesStudyAreaFilter(course, ['INFO'], 'INF'), true)
  assert.equal(courseMatchesStudyAreaFilter(course, ['PRAK'], 'INF'), true)
  assert.equal(courseMatchesStudyAreaFilter(course, ['INFO', 'PRAK'], 'INF'), true)
  assert.equal(courseMatchesStudyAreaFilter(course, ['INFO', 'THEO'], 'INF'), false)
})
