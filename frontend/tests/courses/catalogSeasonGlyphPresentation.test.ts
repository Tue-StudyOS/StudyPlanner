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

test('unmapped bachelor programs reuse Informatik electives and medical course numbers', () => {
  const elective = {
    title: 'Databases',
    number: 'INF3000',
    studyAreaOptions: [
      { studyAreaCode: 'INFO', studyAreaName: 'Informatik', programCode: 'BSC_INFO_2021', optionStatus: 'allowed' },
    ],
  }
  const medicine = {
    title: 'Medizinische Terminologie',
    number: 'MDZINF1330',
    studyAreaOptions: [],
  }
  const telemedicine = {
    title: 'Telemedizin',
    number: 'MDZINF2420',
    studyAreaOptions: [
      { studyAreaCode: 'INFO', studyAreaName: 'Informatik', programCode: 'BSC_INFO_2021', optionStatus: 'allowed' },
    ],
  }

  assert.equal(courseMatchesStudyAreaFilter(elective, ['ELECTIVE'], 'BSC_MEDIENINFO_2021'), true)
  assert.equal(courseMatchesStudyAreaFilter(elective, ['ELECTIVE'], 'BSC_INFO_2021'), false)
  assert.equal(courseMatchesStudyAreaFilter(medicine, ['MED_BIO_PHYS'], 'BSC_MEDIZININFO_2021'), true)
  assert.equal(courseMatchesStudyAreaFilter(telemedicine, ['MEDINFO'], 'BSC_MEDIZININFO_2021'), true)
  assert.equal(courseMatchesStudyAreaFilter(elective, ['MED_BIO_PHYS'], 'BSC_MEDIZININFO_2021'), false)
})
