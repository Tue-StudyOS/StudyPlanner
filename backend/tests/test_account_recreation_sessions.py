import sqlite3
import sys
import types
import unittest
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))
workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import authentication, user_privacy  # noqa: E402


class AccountRecreationSessionTest(unittest.IsolatedAsyncioTestCase):
    async def test_recreated_account_rejects_previous_and_legacy_sessions(self) -> None:
        database = sqlite3.connect(':memory:')
        self.addCleanup(database.close)
        database.row_factory = sqlite3.Row
        database.executescript('''
            PRAGMA foreign_keys = ON;
            CREATE TABLE user_auth (
                username TEXT PRIMARY KEY, email TEXT, password_hash TEXT,
                password_salt TEXT, session_version INTEGER DEFAULT 0,
                created_at_unix INTEGER, updated_at_unix INTEGER
            );
            CREATE TABLE user_state (
                username TEXT PRIMARY KEY REFERENCES user_auth(username) ON DELETE CASCADE,
                display_name TEXT, study_program_id INTEGER, regulation_version_id INTEGER,
                current_semester_label TEXT, settings_json TEXT,
                created_at_unix INTEGER, updated_at_unix INTEGER
            );
            CREATE TABLE client_error_log (user_username TEXT);
            CREATE TABLE review_notices (review_id INTEGER, review_snapshot_json TEXT);
            CREATE TABLE course_reviews (id INTEGER, username TEXT);
            CREATE TABLE request_rate_limits (scope TEXT, client_key TEXT);
        ''')

        async def execute(env: Any, sql: str, params: list[Any]) -> None:
            database.execute(sql, params)

        async def fetch_one(env: Any, sql: str, params: list[Any]) -> dict[str, Any] | None:
            row = database.execute(sql, params).fetchone()
            return dict(row) if row else None

        async def profile(env: Any, username: str, *, include_session_version: bool = False) -> dict[str, Any] | None:
            row = database.execute('SELECT * FROM user_auth WHERE username = ?', [username]).fetchone()
            if row is None:
                return None
            result = {'username': row['username'], 'email': row['email']}
            if include_session_version:
                result['_sessionVersion'] = row['session_version']
            return result

        async def execute_batch(env: Any, statements: list[tuple[str, list[Any]]]) -> None:
            with database:
                for sql, params in statements:
                    database.execute(sql, params)

        env = {'AUTH_TOKEN_SECRET': 'synthetic-test-secret'}
        payload = {'username': 'student', 'email': 'student@example.test', 'password': 'test-password'}

        with (
            patch.object(authentication, 'execute', execute),
            patch.object(authentication, 'fetch_one', fetch_one),
            patch.object(authentication, '_get_user_profile', profile),
            patch.object(authentication, '_create_password_hash', AsyncMock(return_value=('hash', 'salt'))),
            patch.object(authentication, '_hash_password', AsyncMock(return_value='hash')),
            patch.object(authentication, 'ensure_user_progress', AsyncMock()),
            patch.object(authentication.secrets, 'randbelow', side_effect=[2**52 - 1, 123456]),
            patch.object(user_privacy, 'execute_batch', execute_batch),
        ):
            original = await authentication.register_user(env, payload, object())
            request = types.SimpleNamespace(headers={'Cookie': f"studyplanner_session={original['token']}"})
            self.assertIsNotNone(await authentication.get_authenticated_session(env, request))
            version = database.execute('SELECT session_version FROM user_auth').fetchone()[0]
            self.assertEqual(version, 2**52)
            self.assertEqual(int(float(version)), version)

            await user_privacy.delete_current_user_account(
                env, request, {'currentPassword': 'test-password', 'confirmation': 'DELETE'},
            )
            self.assertIsNone(await authentication.get_authenticated_session(env, request))

            replacement = await authentication.register_user(env, payload, object())
            self.assertIsNone(await authentication.get_authenticated_session(env, request))
            legacy = authentication._create_auth_token(env, 'student', 0)
            request.headers['Cookie'] = f'studyplanner_session={legacy}'
            self.assertIsNone(await authentication.get_authenticated_session(env, request))
            request.headers['Cookie'] = f"studyplanner_session={replacement['token']}"
            self.assertIsNotNone(await authentication.get_authenticated_session(env, request))
