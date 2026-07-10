import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from http_utils import build_cors_headers  # noqa: E402


class Request:
    def __init__(self, origin: str) -> None:
        self.headers = {'Origin': origin}


class CorsHeadersTest(unittest.TestCase):
    def test_allowed_origin_can_send_secure_session_cookies(self) -> None:
        headers = build_cors_headers(
            Request('https://preview.studyplaner.pages.dev'),
            {'ALLOWED_ORIGINS': 'https://*.studyplaner.pages.dev'},
        )

        self.assertEqual(headers['access-control-allow-origin'], 'https://preview.studyplaner.pages.dev')
        self.assertEqual(headers['access-control-allow-credentials'], 'true')
        self.assertIn('X-CSRF-Token', headers['access-control-allow-headers'])

    def test_wildcard_cors_never_enables_credentials(self) -> None:
        headers = build_cors_headers(Request('https://example.test'), {'ALLOWED_ORIGINS': '*'})

        self.assertEqual(headers['access-control-allow-origin'], '*')
        self.assertNotIn('access-control-allow-credentials', headers)


if __name__ == '__main__':
    unittest.main()
