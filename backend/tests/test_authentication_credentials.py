import sqlite3
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import authentication  # noqa: E402


class AuthenticationCredentialsTest(unittest.IsolatedAsyncioTestCase):
    def test_session_revocation_migration_preserves_accounts_at_version_zero(self) -> None:
        database = sqlite3.connect(':memory:')
        self.addCleanup(database.close)
        database.executescript(
            """
            CREATE TABLE user_auth (
                username TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL
            );
            INSERT INTO user_auth VALUES ('student', 'student@example.test', 'hash', 'salt');
            """
        )
        migration_path = (
            Path(__file__).resolve().parents[1]
            / 'migrations'
            / '0037_session_revocation.sql'
        )

        database.executescript(migration_path.read_text(encoding='utf-8'))

        row = database.execute(
            'SELECT session_version FROM user_auth WHERE username = ?',
            ('student',),
        ).fetchone()
        self.assertEqual(row, (0,))

    async def test_password_change_rotates_session_version_and_returns_current_session(self) -> None:
        env = {'AUTH_TOKEN_SECRET': 'test-secret', 'AUTH_TOKEN_TTL_SECONDS': '3600'}
        user = {'username': 'student@example.test'}
        execute = AsyncMock()

        with (
            patch.object(authentication, 'require_authenticated_user', AsyncMock(return_value=user)),
            patch.object(
                authentication,
                'fetch_one',
                AsyncMock(return_value={
                    'passwordHash': 'current-hash',
                    'passwordSalt': 'current-salt',
                    'sessionVersion': 3,
                }),
            ),
            patch.object(authentication, '_hash_password', AsyncMock(return_value='current-hash')),
            patch.object(
                authentication,
                '_create_password_hash',
                AsyncMock(return_value=('next-hash', 'next-salt')),
            ),
            patch.object(authentication, 'execute', execute),
            patch.object(authentication, '_get_user_profile', AsyncMock(return_value=user)),
        ):
            result = await authentication.update_user_credentials(
                env,
                object(),
                {'currentPassword': 'old-password', 'newPassword': 'new-password'},
            )

        execute.assert_awaited_once()
        update_sql = execute.await_args.args[1]
        self.assertIn('session_version = session_version + 1', update_sql)
        token_payload = authentication._verify_auth_token(env, str(result['token']))
        self.assertIsNotNone(token_payload)
        self.assertEqual(token_payload['sessionVersion'], 4)
        self.assertEqual(result['user'], user)


if __name__ == '__main__':
    unittest.main()
