import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CATALOG_SEASON_GLYPH_PRESENTATIONS,
  getCatalogSeasonGlyphPresentation,
} from '../../src/features/courses/utils/catalogSeasonGlyphPresentation.ts'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

test('catalog season glyph presentations are distinct and cover many motifs', () => {
  const serialized = CATALOG_SEASON_GLYPH_PRESENTATIONS.map((entry) => `${entry.motif}:${entry.tone}`)
  assert.equal(new Set(serialized).size, CATALOG_SEASON_GLYPH_PRESENTATIONS.length)

  const distinctMotifs = new Set(CATALOG_SEASON_GLYPH_PRESENTATIONS.map((entry) => entry.motif))
  assert.ok(distinctMotifs.size >= 12, `expected at least 12 motifs, got ${distinctMotifs.size}`)
})

test('getCatalogSeasonGlyphPresentation cycles by card index', () => {
  const count = CATALOG_SEASON_GLYPH_PRESENTATIONS.length

  assert.deepEqual(getCatalogSeasonGlyphPresentation(0), CATALOG_SEASON_GLYPH_PRESENTATIONS[0])
  assert.deepEqual(getCatalogSeasonGlyphPresentation(count - 1), CATALOG_SEASON_GLYPH_PRESENTATIONS[count - 1])
  assert.deepEqual(getCatalogSeasonGlyphPresentation(count), CATALOG_SEASON_GLYPH_PRESENTATIONS[0])
  assert.deepEqual(getCatalogSeasonGlyphPresentation(count + 3), CATALOG_SEASON_GLYPH_PRESENTATIONS[3])
  assert.deepEqual(getCatalogSeasonGlyphPresentation(count * 5 + 7), CATALOG_SEASON_GLYPH_PRESENTATIONS[7])
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
