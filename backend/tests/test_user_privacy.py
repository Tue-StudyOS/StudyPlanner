import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import user_privacy  # noqa: E402


class UserPrivacyTest(unittest.IsolatedAsyncioTestCase):
    async def test_deletion_rejects_missing_confirmation_before_password_check(self) -> None:
        with (
            patch.object(
                user_privacy,
                'require_authenticated_user',
                AsyncMock(return_value={'username': 'alice', 'email': 'alice@example.test'}),
            ),
            patch.object(user_privacy, 'verify_user_password', AsyncMock()) as verify_password,
            patch.object(user_privacy, 'execute_batch', AsyncMock()) as execute_batch,
        ):
            with self.assertRaisesRegex(user_privacy.AccountDeletionError, 'Type DELETE'):
                await user_privacy.delete_current_user_account(
                    {}, object(), {'currentPassword': 'secret', 'confirmation': 'delete'}
                )

        verify_password.assert_not_awaited()
        execute_batch.assert_not_awaited()

    async def test_deletion_rejects_wrong_password_without_writes(self) -> None:
        with (
            patch.object(
                user_privacy,
                'require_authenticated_user',
                AsyncMock(return_value={'username': 'alice', 'email': 'alice@example.test'}),
            ),
            patch.object(user_privacy, 'verify_user_password', AsyncMock(return_value=False)),
            patch.object(user_privacy, 'execute_batch', AsyncMock()) as execute_batch,
        ):
            with self.assertRaisesRegex(user_privacy.AccountDeletionError, 'incorrect'):
                await user_privacy.delete_current_user_account(
                    {}, object(), {'currentPassword': 'wrong', 'confirmation': 'DELETE'}
                )

        execute_batch.assert_not_awaited()

    async def test_deletion_detaches_diagnostics_and_erases_account_in_one_batch(self) -> None:
        execute_batch = AsyncMock(return_value=[])
        with (
            patch.object(
                user_privacy,
                'require_authenticated_user',
                AsyncMock(return_value={'username': 'alice', 'email': 'alice@example.test'}),
            ),
            patch.object(user_privacy, 'verify_user_password', AsyncMock(return_value=True)),
            patch.object(user_privacy, 'execute_batch', execute_batch),
        ):
            await user_privacy.delete_current_user_account(
                {}, object(), {'currentPassword': 'secret', 'confirmation': 'DELETE'}
            )

        execute_batch.assert_awaited_once()
        statements = execute_batch.await_args.args[1]
        self.assertEqual(len(statements), 4)
        self.assertIn('UPDATE client_error_log', statements[0][0])
        self.assertIn('removedOnAccountDeletion', statements[1][0])
        self.assertIn('DELETE FROM request_rate_limits', statements[2][0])
        self.assertIn('DELETE FROM user_auth', statements[3][0])
        self.assertEqual(statements[0][1], ['alice'])
        self.assertEqual(statements[1][1], ['alice'])
        self.assertNotIn('alice', statements[2][1])
        self.assertNotIn('alice@example.test', statements[2][1])
        self.assertEqual(statements[3][1], ['alice'])


if __name__ == '__main__':
    unittest.main()
