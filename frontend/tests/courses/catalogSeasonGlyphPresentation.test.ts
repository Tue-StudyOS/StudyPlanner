import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CATALOG_SEASON_GLYPH_PRESENTATIONS,
  getCatalogSeasonGlyphPresentation,
} from '../../src/features/courses/utils/catalogSeasonGlyphPresentation.ts'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

test('catalog season glyph presentations cycle twenty-two layouts including faint variants', () => {
  assert.equal(CATALOG_SEASON_GLYPH_PRESENTATIONS.length, 22)
  assert.deepEqual(getCatalogSeasonGlyphPresentation(0), { layout: 'right-half', strength: 'strong' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(13), { layout: 'bottom-right', strength: 'gray' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(14), { layout: 'right-half', strength: 'softer' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(17), { layout: 'right-half', strength: 'gray-softer' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(21), { layout: 'bottom-right', strength: 'gray-softer' })
  assert.deepEqual(getCatalogSeasonGlyphPresentation(22), CATALOG_SEASON_GLYPH_PRESENTATIONS[0])
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
