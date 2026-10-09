import contextlib
import io
import json
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
from diagnostic_redaction import safe_exception_summary  # noqa: E402


class Response:
    def __init__(self, body: bytes | None, *, status: int, headers: dict[str, str]) -> None:
        self.body = body
        self.status = status
        self.headers = headers


class Request:
    method = 'GET'
    url = 'https://example.test/api/config?token=private-query'

    def __init__(self, request_id: str = 'diagnostic-request-1') -> None:
        self.headers = {'X-Request-ID': request_id, 'CF-Ray': 'abc123-FRA'}


class RequestDiagnosticsTest(unittest.IsolatedAsyncioTestCase):
    def test_correlation_is_stable_and_rejects_untrusted_header_values(self) -> None:
        request = Request()
        headers = http_utils.build_cors_headers(request, {'WORKER_VERSION': {'id': 'version-1'}})
        self.assertEqual(headers['x-request-id'], 'diagnostic-request-1')
        self.assertEqual(headers['x-worker-version'], 'version-1')
        self.assertIn('X-Request-ID', headers['access-control-allow-headers'])
        self.assertIn('cf-ray', headers['access-control-expose-headers'])
        self.assertEqual(http_utils.get_request_id(Request('bad\nCookie: private')), 'abc123-FRA')
        request.headers.clear()
        self.assertEqual(http_utils.get_request_id(request), http_utils.get_request_id(request))

    async def test_router_logs_database_and_unexpected_failures_without_leaking_input(self) -> None:
        for exception, expected_code in [
            (router.D1ExecutionError('D1 failed: password="private value"'), 'database_error'),
            (ValueError('token=private-token ada@example.test'), 'internal_server_error'),
        ]:
            with self.subTest(code=expected_code):
                output = io.StringIO()
                with (
                    patch.object(http_utils, 'Response', Response),
                    patch.object(router, 'get_simulated_semester_label', AsyncMock(side_effect=exception)),
                    contextlib.redirect_stderr(output),
                ):
                    response = await router.route_request(Request(), {'WORKER_VERSION': {'id': 'version-1'}})
                event = json.loads(output.getvalue())
                self.assertEqual(response.status, 500)
                self.assertEqual(response.headers['x-error-source'], 'application')
                self.assertEqual(json.loads(response.body)['requestId'], event['requestId'])
                self.assertEqual(event['code'], expected_code)
                self.assertEqual(event['exceptionType'], type(exception).__name__)
                self.assertEqual(event['path'], '/api/config')
                self.assertEqual(event['workerVersion'], 'version-1')
                self.assertTrue(event['frames'])
                for secret in ('private-query', 'private value', 'private-token', 'ada@example.test'):
                    self.assertNotIn(secret, output.getvalue())
                    self.assertNotIn(secret, response.body.decode())

    def test_arbitrary_exception_values_are_omitted_but_known_faults_remain(self) -> None:
        self.assertIsNone(safe_exception_summary(ValueError('student result: private personal data')))
        self.assertEqual(
            safe_exception_summary(router.D1ExecutionError('D1 query failed: no such table: courses; private value')),
            'no such table: courses',
        )
        self.assertEqual(safe_exception_summary(RuntimeError('code had hung')), 'code had hung')

    def test_expected_client_errors_do_not_emit_server_failure_events(self) -> None:
        output = io.StringIO()
        with patch.object(http_utils, 'Response', Response), contextlib.redirect_stderr(output):
            response = http_utils.error_response('not_found', 'Not found.', Request(), {}, 404)
        self.assertEqual(response.status, 404)
        self.assertEqual(output.getvalue(), '')


if __name__ == '__main__':
    unittest.main()
