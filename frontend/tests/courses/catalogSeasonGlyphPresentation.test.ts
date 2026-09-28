import assert from 'node:assert/strict'
import test from 'node:test'
import { courseMatchesStudyAreaFilter } from '../../src/features/courses/utils/studyAreaFilter.ts'

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

test('area filters match only tags of the selected study program', () => {
  const chemistry = {
    studyAreaOptions: [
      { studyAreaCode: 'LIFE', studyAreaName: 'Lebenswissenschaften', programCode: 'BSC_BIOINFO_2021', optionStatus: 'required' },
      { studyAreaCode: 'INFO', studyAreaName: 'Informatik', programCode: 'BSC_INFO_2021', optionStatus: 'allowed' },
    ],
  }
  const elective = {
    studyAreaOptions: [
      { studyAreaCode: 'INFO', studyAreaName: 'Informatik', programCode: 'BSC_INFO_2021', optionStatus: 'allowed' },
    ],
  }

  assert.equal(courseMatchesStudyAreaFilter(chemistry, ['LIFE'], 'BSC_BIOINFO_2021'), true)
  assert.equal(courseMatchesStudyAreaFilter(chemistry, ['LIFE'], 'BSC_MEDIENINFO_2021'), false)
  assert.equal(courseMatchesStudyAreaFilter(elective, ['ELECTIVE'], 'BSC_MEDIENINFO_2021'), false)
  assert.equal(courseMatchesStudyAreaFilter(elective, ['ELECTIVE'], 'BSC_BIOINFO_2021'), false)
  assert.equal(courseMatchesStudyAreaFilter(chemistry, ['INFO'], 'BSC_INFO_2021'), true)
})
