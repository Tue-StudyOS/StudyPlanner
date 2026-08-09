import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCOUNT_DELETION_CONFIRMATION,
  canSubmitAccountDeletion,
} from '../../src/features/auth/utils/accountPrivacy.ts'

test('account deletion requires a password and the exact explicit confirmation', () => {
  assert.equal(canSubmitAccountDeletion('current password', ACCOUNT_DELETION_CONFIRMATION), true)
  assert.equal(canSubmitAccountDeletion('', ACCOUNT_DELETION_CONFIRMATION), false)
  assert.equal(canSubmitAccountDeletion('current password', 'delete'), false)
  assert.equal(canSubmitAccountDeletion('current password', ' DELETE '), false)
})
