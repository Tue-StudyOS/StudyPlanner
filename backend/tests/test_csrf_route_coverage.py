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
    def get(self, name: str) -> str | None:
        del name
        return None


class FakeRequest:
    def __init__(self, method: str, path: str) -> None:
        self.method = method
        self.url = f'https://api.example.com{path}'
        self.headers = FakeHeaders()


ENV = {'ALLOWED_ORIGINS': 'https://app.example.com'}


class CsrfRouteCoverageTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        response_patch = patch.object(http_utils, 'Response', CapturedResponse)
        response_patch.start()
        self.addCleanup(response_patch.stop)

    async def test_every_authenticated_mutation_prefix_fails_before_dispatch_without_csrf(self) -> None:
        state_changing_routes = (
            ('POST', '/api/auth/logout'),
            ('PATCH', '/api/me/profile'),
            ('PATCH', '/api/me/credentials'),
            ('DELETE', '/api/me/account'),
            ('PUT', '/api/me/favorites'),
            ('PUT', '/api/me/course-reviews/1'),
            ('DELETE', '/api/me/course-reviews/1'),
            ('PUT', '/api/me/completed-courses'),
            ('POST', '/api/me/completed-courses/import'),
            ('PUT', '/api/me/transcript-issues'),
            ('PUT', '/api/me/transcript-data'),
            ('PUT', '/api/me/semester-plans'),
            ('POST', '/api/me/semester-plans/ws-2026/balance'),
            ('PUT', '/api/me/semester-plans/ws-2026'),
            ('PATCH', '/api/admin/course-reviews/1'),
        )

        for method, path in state_changing_routes:
            with self.subTest(method=method, path=path):
                csrf_guard = AsyncMock(
                    side_effect=router.CsrfProtectionError('Security check failed.')
                )
                with patch.object(router, 'require_csrf_protection', csrf_guard):
                    response = await router.route_request(FakeRequest(method, path), ENV)

                csrf_guard.assert_awaited_once()
                self.assertEqual(response.kwargs['status'], 403)


if __name__ == '__main__':
    unittest.main()
