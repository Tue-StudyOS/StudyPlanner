import assert from 'node:assert/strict'
import test from 'node:test'
import { cleanLecturerName, formatCourseLecturerName } from '../../src/features/courses/utils/lecturerName.ts'

test('cleanLecturerName strips stacked academic titles', () => {
  assert.equal(cleanLecturerName('o. Prof. Dr. rer. nat. Torsten Grust'), 'Torsten Grust')
  assert.equal(cleanLecturerName('Prof. Dr. Torsten Grust'), 'Torsten Grust')
  assert.equal(cleanLecturerName('Dr. Anna Müller'), 'Anna Müller')
  assert.equal(cleanLecturerName('PD Dr. rer. nat. habil. Hans-Peter Meier'), 'Hans-Peter Meier')
})

test('cleanLecturerName handles dotted degree abbreviations generically', () => {
  assert.equal(cleanLecturerName('Dr.-Ing. Max Schmidt'), 'Max Schmidt')
  assert.equal(cleanLecturerName('Dipl.-Inform. Eva Braun'), 'Eva Braun')
  assert.equal(cleanLecturerName('Jun.-Prof. Dr. Lisa Weber'), 'Lisa Weber')
  assert.equal(cleanLecturerName('John Smith Ph.D.'), 'John Smith')
  assert.equal(cleanLecturerName('M.Sc. Tom Lang'), 'Tom Lang')
  assert.equal(cleanLecturerName('Prof. Dr. h.c. Karl Otto'), 'Karl Otto')
})

test('cleanLecturerName keeps name particles, hyphens, and umlauts', () => {
  assert.equal(cleanLecturerName('Prof. Dr. Ludwig von Beethoven'), 'Ludwig von Beethoven')
  assert.equal(cleanLecturerName('Dr. Jan van der Berg'), 'Jan van der Berg')
  assert.equal(cleanLecturerName('apl. Prof. Dr. Jürgen Größler'), 'Jürgen Größler')
})

test('cleanLecturerName cleans multiple lecturers and rejoins with commas', () => {
  assert.equal(
    cleanLecturerName('Prof. Dr. Torsten Grust; Dr. Anna Müller'),
    'Torsten Grust, Anna Müller',
  )
  assert.equal(
    cleanLecturerName('Prof. Dr. Torsten Grust / PD Dr. Hans-Peter Meier'),
    'Torsten Grust, Hans-Peter Meier',
  )
  assert.equal(
    cleanLecturerName('Dr. Anna Müller, Prof. Dr. Torsten Grust'),
    'Anna Müller, Torsten Grust',
  )
})

test('formatCourseLecturerName deduplicates structured lecturer names', () => {
  assert.equal(
    formatCourseLecturerName({
      lecturer: 'Prof. Dr. Anna Müller, Prof. Dr. Anna Müller',
      lecturers: ['Prof. Dr. Anna Müller', 'Prof. Dr. Torsten Grust'],
    }),
    'Anna Müller, Torsten Grust',
  )
})

test('formatCourseLecturerName returns empty when no lecturer is known', () => {
  assert.equal(formatCourseLecturerName({ lecturer: '', lecturers: [] }), '')
  assert.equal(formatCourseLecturerName({ lecturer: 'TBA', lecturers: [] }), '')
})

test('cleanLecturerName handles empty, whitespace, and placeholder input gracefully', () => {
  assert.equal(cleanLecturerName(''), '')
  assert.equal(cleanLecturerName('   '), '')
  assert.equal(cleanLecturerName('TBA'), 'TBA')
})

test('cleanLecturerName never empties a title-only string', () => {
  assert.equal(cleanLecturerName('Prof. Dr.'), 'Prof. Dr.')
})
