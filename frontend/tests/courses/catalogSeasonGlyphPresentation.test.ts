import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCatalogSeasonGlyphPresentation,
} from '../../src/features/courses/utils/catalogSeasonGlyphPresentation.ts'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

test('getCatalogSeasonGlyphPresentation cycles three layouts for the first six cards', () => {
  assert.deepEqual(getCatalogSeasonGlyphPresentation(0), { layout: 'right-half', strength: 'strong' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(1), { layout: 'ects-inline', strength: 'strong' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(2), { layout: 'bottom-left', strength: 'soft' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(3), { layout: 'right-half', strength: 'soft' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(4), { layout: 'ects-inline', strength: 'gray' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(5), { layout: 'bottom-left', strength: 'gray' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(6), { layout: 'right-half', strength: 'strong' })
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
