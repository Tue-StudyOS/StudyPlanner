import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from http_utils import (  # noqa: E402
    HTML_CONTENT_SECURITY_POLICY,
    SECURITY_HEADERS,
    build_cors_headers,
)


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

    def test_disallowed_origin_receives_no_cors_access(self) -> None:
        headers = build_cors_headers(
            Request('https://attacker.example'),
            {'ALLOWED_ORIGINS': 'https://studyplaner.pages.dev'},
        )

        self.assertNotIn('access-control-allow-origin', headers)
        self.assertNotIn('access-control-allow-credentials', headers)

    def test_api_security_headers_deny_browser_content_by_default(self) -> None:
        self.assertEqual(SECURITY_HEADERS['x-content-type-options'], 'nosniff')
        self.assertEqual(SECURITY_HEADERS['x-frame-options'], 'DENY')
        self.assertIn("default-src 'none'", SECURITY_HEADERS['content-security-policy'])
        self.assertIn("frame-ancestors 'none'", SECURITY_HEADERS['content-security-policy'])
        self.assertIn('max-age=31536000', SECURITY_HEADERS['strict-transport-security'])

    def test_privacy_html_policy_allows_its_inline_styles_but_no_scripts(self) -> None:
        self.assertIn("style-src 'unsafe-inline'", HTML_CONTENT_SECURITY_POLICY)
        self.assertIn("default-src 'none'", HTML_CONTENT_SECURITY_POLICY)
        self.assertNotIn('script-src', HTML_CONTENT_SECURITY_POLICY)


if __name__ == '__main__':
    unittest.main()
