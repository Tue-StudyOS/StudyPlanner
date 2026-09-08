import assert from 'node:assert/strict'
import test from 'node:test'
import { getLegalContactHref, LEGAL_OPERATOR } from '../src/features/legal/legalOperator.ts'

test('sample operator details cannot direct personal requests to a fictional mailbox', () => {
  assert.equal(LEGAL_OPERATOR.isPreview, true)
  assert.equal(getLegalContactHref(LEGAL_OPERATOR), undefined)
  assert.equal(getLegalContactHref({ ...LEGAL_OPERATOR, isPreview: false }), undefined)
})

test('a verified replacement mailbox gets an encoded request subject', () => {
  const operator = { ...LEGAL_OPERATOR, isPreview: false, email: 'privacy@example.org' }
  assert.equal(getLegalContactHref(operator), 'mailto:privacy@example.org?subject=StudyPlanner%3A%20Datenschutzanfrage')
  assert.equal(getLegalContactHref({ ...operator, isPreview: true }), undefined)
})
