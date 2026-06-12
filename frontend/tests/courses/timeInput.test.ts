import assert from 'node:assert/strict'
import test from 'node:test'
import {
  completeTimeDigits,
  formatTimeDigits,
  sanitizeTimeDigits,
  timeDigitsToMinutes,
} from '../../src/features/courses/utils/timeInput.ts'

test('sanitizeTimeDigits keeps at most four digits', () => {
  assert.equal(sanitizeTimeDigits('14:30'), '1430')
  assert.equal(sanitizeTimeDigits('abc9'), '9')
  assert.equal(sanitizeTimeDigits('123456'), '1234')
})

test('formatTimeDigits inserts the colon after two digits', () => {
  assert.equal(formatTimeDigits(''), '')
  assert.equal(formatTimeDigits('1'), '1')
  assert.equal(formatTimeDigits('14'), '14')
  assert.equal(formatTimeDigits('143'), '14:3')
  assert.equal(formatTimeDigits('1430'), '14:30')
})

test('completeTimeDigits defaults skipped minutes to 00', () => {
  assert.equal(completeTimeDigits(''), '')
  assert.equal(completeTimeDigits('9'), '0900')
  assert.equal(completeTimeDigits('14'), '1400')
  assert.equal(completeTimeDigits('143'), '1430')
  assert.equal(completeTimeDigits('1430'), '1430')
})

test('completeTimeDigits clamps out-of-range values', () => {
  assert.equal(completeTimeDigits('25'), '2300')
  assert.equal(completeTimeDigits('1499'), '1459')
})

test('timeDigitsToMinutes converts completed input', () => {
  assert.equal(timeDigitsToMinutes(''), null)
  assert.equal(timeDigitsToMinutes('9'), 540)
  assert.equal(timeDigitsToMinutes('1430'), 870)
})
