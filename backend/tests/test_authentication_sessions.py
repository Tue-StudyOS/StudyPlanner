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


if __name__ == '__main__':
    unittest.main()
