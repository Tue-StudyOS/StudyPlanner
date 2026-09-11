import assert from 'node:assert/strict'
import test from 'node:test'
import { LEGAL_OPERATOR } from '../src/features/legal/legalOperator.ts'

test('legal pages share the supplied operator identity', () => {
  assert.equal(LEGAL_OPERATOR.name, 'Yonatan Dankner')
  assert.deepEqual(LEGAL_OPERATOR.addressLines, ['Hafengasse 11', '72070 Tübingen', 'Deutschland'])
})

test('public contact uses a readable obfuscated email without a raw address or mailto', () => {
  assert.equal(LEGAL_OPERATOR.emailDisplay, 'yonatan.dankner (at) gmail.com')
  assert.equal(JSON.stringify(LEGAL_OPERATOR).includes('@'), false)
  assert.equal(JSON.stringify(LEGAL_OPERATOR).includes('mailto:'), false)
})
