import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CATALOG_SEASON_GLYPH_PRESENTATIONS,
  getCatalogSeasonGlyphPresentation,
} from '../../src/features/courses/utils/catalogSeasonGlyphPresentation.ts'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

test('catalog season glyph presentations cycle twelve soft and gray layouts', () => {
  assert.equal(CATALOG_SEASON_GLYPH_PRESENTATIONS.length, 12)
  assert.deepEqual(getCatalogSeasonGlyphPresentation(0), { layout: 'right-half', strength: 'soft' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(7), { layout: 'ects-inline', strength: 'gray' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(11), { layout: 'bottom-right', strength: 'gray' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(12), CATALOG_SEASON_GLYPH_PRESENTATIONS[0])
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
