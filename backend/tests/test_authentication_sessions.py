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


class Request:
    def __init__(self, headers: dict[str, str], url: str = 'https://studyplaner.pages.dev/api/auth/session') -> None:
        self.headers = headers
        self.url = url


class AuthenticationSessionTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.env = {'AUTH_TOKEN_SECRET': 'test-secret', 'AUTH_TOKEN_TTL_SECONDS': '3600'}
        self.token = authentication._create_auth_token(self.env, 'student@example.test')

    def test_cookie_is_httponly_and_secure_in_deployment(self) -> None:
        cookie = authentication.create_auth_cookie(
            self.env,
            Request({}),
            self.token,
        )

        self.assertIn('HttpOnly', cookie)
        self.assertIn('Secure', cookie)
        self.assertIn('SameSite=None', cookie)
        self.assertNotIn('Domain=', cookie)

    def test_cookie_token_wins_over_a_legacy_bearer_token(self) -> None:
        request = Request({
            'Cookie': f'{authentication.AUTH_COOKIE_NAME}={self.token}',
            'Authorization': 'Bearer legacy-token',
        })

        self.assertEqual(authentication._extract_auth_token(request), self.token)

    async def test_csrf_protection_accepts_only_the_token_bound_to_the_cookie(self) -> None:
        request = Request({'Cookie': f'{authentication.AUTH_COOKIE_NAME}={self.token}'})
        request.headers[authentication.CSRF_HEADER_NAME] = authentication.create_csrf_token(self.env, self.token)
        profile = {'username': 'student@example.test'}

        with patch.object(authentication, '_get_user_profile', AsyncMock(return_value=profile)):
            self.assertEqual(await authentication.require_csrf_protection(self.env, request), profile)

        request.headers[authentication.CSRF_HEADER_NAME] = 'incorrect'
        with patch.object(authentication, '_get_user_profile', AsyncMock(return_value=profile)):
            with self.assertRaises(authentication.CsrfProtectionError):
                await authentication.require_csrf_protection(self.env, request)

    async def test_token_stops_authenticating_after_its_account_is_deleted(self) -> None:
        request = Request({'Cookie': f'{authentication.AUTH_COOKIE_NAME}={self.token}'})

        with patch.object(authentication, '_get_user_profile', AsyncMock(return_value=None)):
            self.assertIsNone(await authentication.get_authenticated_session(self.env, request))

    async def test_credential_change_invalidates_older_session_versions(self) -> None:
        request = Request({'Cookie': f'{authentication.AUTH_COOKIE_NAME}={self.token}'})
        profile = {
            'username': 'student@example.test',
            '_sessionVersion': 1,
        }

        with patch.object(authentication, '_get_user_profile', AsyncMock(return_value=profile)):
            self.assertIsNone(await authentication.get_authenticated_session(self.env, request))

    async def test_current_session_version_authenticates(self) -> None:
        current_token = authentication._create_auth_token(
            self.env,
            'student@example.test',
            session_version=2,
        )
        request = Request({'Cookie': f'{authentication.AUTH_COOKIE_NAME}={current_token}'})
        profile = {
            'username': 'student@example.test',
            '_sessionVersion': 2,
        }

        with patch.object(authentication, '_get_user_profile', AsyncMock(return_value=profile)):
            session = await authentication.get_authenticated_session(self.env, request)

        self.assertIsNotNone(session)
        self.assertEqual(session['user'], {'username': 'student@example.test'})

    def test_legacy_token_claims_default_to_session_version_zero(self) -> None:
        issued_at_unix = authentication.now_unix()
        header = authentication._json_token_part({
            'alg': 'HS256',
            'typ': 'StudyPlannerAuthToken',
        })
        payload = authentication._json_token_part({
            'username': 'student@example.test',
            'iat': issued_at_unix,
            'exp': issued_at_unix + 3600,
        })
        unsigned_token = f'{header}.{payload}'
        signature = authentication._sign_token_input(unsigned_token, 'test-secret')

        token_payload = authentication._verify_auth_token(
            self.env,
            f'{unsigned_token}.{signature}',
        )

        self.assertIsNotNone(token_payload)
        self.assertEqual(token_payload['sessionVersion'], 0)


if __name__ == '__main__':
    unittest.main()
