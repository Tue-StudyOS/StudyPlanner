import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeDiagnosticPath,
  redactDiagnosticText,
  sanitizeDiagnosticFields,
} from '../../src/shared/utils/diagnosticRedaction.ts'

test('normalizes diagnostic URLs to paths without queries or fragments', () => {
  assert.equal(
    normalizeDiagnosticPath('https://example.test/api/courses?email=ada@example.test#private'),
    '/api/courses',
  )
  assert.equal(normalizeDiagnosticPath('/planner?student=12'), '/planner')
})

test('redacts common identifiers, secrets, and academic data', () => {
  const value = redactDiagnosticText(
    'ada@example.test Authorization: Bearer abc.def\n'
      + 'Cookie: session=top-cookie; theme=dark\n'
      + 'transcript: Algorithms A, token=top-secret '
      + 'https://example.test/path?email=ada@example.test',
  ) ?? ''

  assert.doesNotMatch(value, /ada@example\.test|abc\.def|top-cookie|Algorithms A|top-secret|email=/)
  assert.match(value, /\[redacted-email\]/)
  assert.match(value, /\[redacted-academic-data\]/)
})

test('sanitizes every diagnostic field before storage or transmission', () => {
  const result = sanitizeDiagnosticFields({
    url: 'https://api.example.test/api/private?token=one',
    message: 'Failure for ada@example.test',
    detail: 'grade=A',
    pagePath: '/planner?username=ada',
    status: 500,
  })

  assert.deepEqual(result, {
    url: '/api/private',
    message: 'Failure for [redacted-email]',
    detail: 'grade: [redacted-academic-data]',
    pagePath: '/planner',
    status: 500,
  })
})
