import assert from 'node:assert/strict'
import test from 'node:test'
import { getLegalContactHref, LEGAL_NOTICE_IS_DRAFT, LEGAL_OPERATOR } from '../src/features/legal/legalOperator.ts'

test('confirmed contact stays usable while legal assessments remain unfinished', () => {
  assert.equal(LEGAL_NOTICE_IS_DRAFT, true)
  assert.equal(LEGAL_OPERATOR.isPreview, false)
  assert.equal(LEGAL_OPERATOR.name, 'Yonatan Dankner')
  assert.deepEqual(LEGAL_OPERATOR.addressLines, ['Hafengasse 11', '72070 Tübingen', 'Deutschland'])
  assert.equal(getLegalContactHref(LEGAL_OPERATOR), 'mailto:yonatan.dankner@gmail.com?subject=StudyPlanner%3A%20Datenschutzanfrage')
})

test('sample operator details cannot direct personal requests to a fictional mailbox', () => {
  const sampleOperator = { ...LEGAL_OPERATOR, isPreview: true, email: 'datenschutz@example.invalid' }
  assert.equal(getLegalContactHref(sampleOperator), undefined)
  assert.equal(getLegalContactHref({ ...sampleOperator, isPreview: false }), undefined)
})

test('a verified replacement mailbox gets an encoded request subject', () => {
  const operator = { ...LEGAL_OPERATOR, isPreview: false, email: 'privacy@example.org' }
  assert.equal(getLegalContactHref(operator), 'mailto:privacy@example.org?subject=StudyPlanner%3A%20Datenschutzanfrage')
  assert.equal(getLegalContactHref({ ...operator, isPreview: true }), undefined)
})
