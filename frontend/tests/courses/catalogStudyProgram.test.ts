import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseStoredStudyProgramId,
  resolveCatalogStudySelection,
} from '../../src/features/courses/utils/catalogStudyProgram.ts'

test('parseStoredStudyProgramId accepts positive integer ids only', () => {
  assert.equal(parseStoredStudyProgramId('2'), 2)
  assert.equal(parseStoredStudyProgramId(' 12 '), 12)
  assert.equal(parseStoredStudyProgramId(null), null)
  assert.equal(parseStoredStudyProgramId(''), null)
  assert.equal(parseStoredStudyProgramId('0'), null)
  assert.equal(parseStoredStudyProgramId('-3'), null)
  assert.equal(parseStoredStudyProgramId('1.5'), null)
  assert.equal(parseStoredStudyProgramId('BSC_INFO_2021'), null)
})

test('resolveCatalogStudySelection prefers the account program over a guest pick', () => {
  const account = {
    studyProgramCode: 'BSC_INFO_2021',
    regulationVersionCode: 'BSC_INFO_2021',
  }
  const guest = {
    studyProgramCode: 'MSC_ML_2021',
    regulationVersionCode: 'MSC_ML_2021',
  }
  assert.deepEqual(resolveCatalogStudySelection(account, guest), account)
  assert.deepEqual(resolveCatalogStudySelection(null, guest), guest)
  assert.deepEqual(resolveCatalogStudySelection(null, null), {
    studyProgramCode: null,
    regulationVersionCode: null,
  })
})
