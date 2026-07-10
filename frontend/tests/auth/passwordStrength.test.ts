import assert from 'node:assert/strict'
import test from 'node:test'

import { getPasswordStrength } from '../../src/features/auth/utils/passwordStrength.ts'

test('getPasswordStrength returns null for empty input', () => {
  assert.equal(getPasswordStrength(''), null)
})

test('getPasswordStrength marks short or simple passwords as weak', () => {
  assert.equal(getPasswordStrength('short'), 'weak')
  assert.equal(getPasswordStrength('abcdefgh'), 'weak')
})

test('getPasswordStrength marks varied longer passwords as strong', () => {
  assert.equal(getPasswordStrength('abcdefgh1'), 'strong')
  assert.equal(getPasswordStrength('MyPassword1'), 'strong')
})
