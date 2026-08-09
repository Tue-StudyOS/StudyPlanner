import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault("workers", workers)

from services.client_error_log import (  # noqa: E402
    ClientErrorLogError,
    _normalize_path,
    _redact_text,
    _validate_method,
    _validate_status,
    is_diagnostics_administrator,
)


class ClientErrorLogValidationTest(unittest.TestCase):
    def test_validate_method_accepts_get(self) -> None:
        self.assertEqual(_validate_method("get"), "GET")

    def test_validate_method_rejects_unknown(self) -> None:
        with self.assertRaises(ClientErrorLogError):
            _validate_method("TRACE")

    def test_validate_status_accepts_zero(self) -> None:
        self.assertEqual(_validate_status(0), 0)

    def test_validate_status_rejects_out_of_range(self) -> None:
        with self.assertRaises(ClientErrorLogError):
            _validate_status(1000)

    def test_only_configured_usernames_are_diagnostics_administrators(self) -> None:
        env = {'DIAGNOSTICS_ADMIN_USERNAMES': 'operator@example.test,other@example.test'}

        self.assertTrue(is_diagnostics_administrator(env, 'operator@example.test'))
        self.assertFalse(is_diagnostics_administrator(env, 'student@example.test'))
        self.assertFalse(is_diagnostics_administrator({}, 'operator@example.test'))

    def test_normalize_path_removes_origin_query_and_fragment(self) -> None:
        self.assertEqual(
            _normalize_path(
                'https://example.test/api/courses?student=ada@example.test#private',
                max_length=2048,
            ),
            '/api/courses',
        )

    def test_redact_text_removes_common_personal_and_secret_values(self) -> None:
        redacted = _redact_text(
            'ada@example.test Authorization: Bearer abc.def\n'
            'Cookie: session=top-cookie; theme=dark\n'
            'transcript: Algorithms A, token=top-secret '
            'https://example.test/path?email=ada@example.test',
            max_length=4000,
        )

        self.assertNotIn('ada@example.test', redacted)
        self.assertNotIn('abc.def', redacted)
        self.assertNotIn('top-cookie', redacted)
        self.assertNotIn('Algorithms A', redacted)
        self.assertNotIn('top-secret', redacted)
        self.assertNotIn('email=', redacted)
        self.assertIn('[redacted-email]', redacted)
        self.assertIn('[redacted-academic-data]', redacted)


if __name__ == "__main__":
    unittest.main()
