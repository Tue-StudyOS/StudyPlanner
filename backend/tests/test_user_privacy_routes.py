import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

import http_utils  # noqa: E402
import router  # noqa: E402


class CapturedResponse:
    def __init__(self, body: object = None, **kwargs: object) -> None:
        self.body = body
        self.kwargs = kwargs


class FakeHeaders:
    def __init__(self, values: dict[str, str] | None = None) -> None:
        self.values = {key.lower(): value for key, value in (values or {}).items()}

    def get(self, name: str) -> str | None:
        return self.values.get(name.lower())


class FakeRequest:
    def __init__(self, method: str, path: str) -> None:
        self.method = method
        self.url = f'https://api.example.com{path}'
        self.headers = FakeHeaders()


ENV = {'ALLOWED_ORIGINS': 'https://app.example.com'}


class UserPrivacyRouteTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        response_patch = patch.object(http_utils, 'Response', CapturedResponse)
        response_patch.start()
        self.addCleanup(response_patch.stop)

    async def test_deletion_requires_csrf_and_clears_session_cookie(self) -> None:
        require_csrf = AsyncMock()
        delete_account = AsyncMock()
        with (
            patch.object(router, 'require_csrf_protection', require_csrf),
            patch.object(router, 'delete_current_user_account', delete_account),
            patch.object(
                router,
                'read_json_object',
                AsyncMock(return_value={'currentPassword': 'secret', 'confirmation': 'DELETE'}),
            ),
        ):
            response = await router.route_request(
                FakeRequest('DELETE', '/api/me/account'),
                ENV,
            )

        require_csrf.assert_awaited_once()
        delete_account.assert_awaited_once()
        headers = response.kwargs['headers']
        self.assertIn('Max-Age=0', headers['set-cookie'])
        self.assertEqual(headers['cache-control'], 'no-store')
        self.assertEqual(response.kwargs['status'], 204)

    async def test_deletion_rejects_an_unauthenticated_request(self) -> None:
        with patch.object(
            router,
            'require_csrf_protection',
            AsyncMock(side_effect=router.AuthorizationError('Authentication is required.')),
        ):
            response = await router.route_request(
                FakeRequest('DELETE', '/api/me/account'),
                ENV,
            )

        self.assertEqual(response.kwargs['status'], 401)

    async def test_deletion_rejects_a_missing_csrf_proof(self) -> None:
        with patch.object(
            router,
            'require_csrf_protection',
            AsyncMock(side_effect=router.CsrfProtectionError('Security check failed.')),
        ):
            response = await router.route_request(
                FakeRequest('DELETE', '/api/me/account'),
                ENV,
            )

        self.assertEqual(response.kwargs['status'], 403)

    async def test_wrong_password_is_a_safe_client_error(self) -> None:
        with (
            patch.object(router, 'require_csrf_protection', AsyncMock()),
            patch.object(
                router,
                'delete_current_user_account',
                AsyncMock(side_effect=router.AccountDeletionError('Current password is incorrect.')),
            ),
            patch.object(router, 'read_json_object', AsyncMock(return_value={})),
        ):
            response = await router.route_request(
                FakeRequest('DELETE', '/api/me/account'),
                ENV,
            )

        self.assertEqual(response.kwargs['status'], 400)


if __name__ == '__main__':
    unittest.main()
