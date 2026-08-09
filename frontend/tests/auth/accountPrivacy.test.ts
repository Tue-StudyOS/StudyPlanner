import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  ACCOUNT_EXPORT_FILENAME,
  canSubmitAccountDeletion,
} from '../../src/features/auth/utils/accountPrivacy.ts'

test('account deletion requires a password and the exact explicit confirmation', () => {
  assert.equal(canSubmitAccountDeletion('current password', ACCOUNT_DELETION_CONFIRMATION), true)
  assert.equal(canSubmitAccountDeletion('', ACCOUNT_DELETION_CONFIRMATION), false)
  assert.equal(canSubmitAccountDeletion('current password', 'delete'), false)
  assert.equal(canSubmitAccountDeletion('current password', ' DELETE '), false)
})

test('account export uses a fixed safe JSON filename', () => {
  assert.equal(ACCOUNT_EXPORT_FILENAME, 'studyplanner-data-export.json')
  assert.doesNotMatch(ACCOUNT_EXPORT_FILENAME, /[\\/:*?"<>|]/)
})
