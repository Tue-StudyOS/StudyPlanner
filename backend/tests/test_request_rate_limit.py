import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import request_rate_limit  # noqa: E402


class Request:
    def __init__(self, client_ip: str) -> None:
        self.headers = {'CF-Connecting-IP': client_ip}


class RequestRateLimitTest(unittest.IsolatedAsyncioTestCase):
    def test_client_key_does_not_retain_the_raw_ip_address(self) -> None:
        client_key = request_rate_limit._client_key(Request('198.51.100.10'))

        self.assertEqual(len(client_key), 64)
        self.assertNotIn('198.51.100.10', client_key)

    async def test_request_at_limit_is_rejected_with_window_retry_time(self) -> None:
        policy = request_rate_limit.RateLimitPolicy('test', maximum_requests=2, window_seconds=60)
        fetch_one = AsyncMock(return_value={'requestCount': 3})

        with patch.object(request_rate_limit, 'fetch_one', fetch_one):
            with self.assertRaises(request_rate_limit.RateLimitError) as context:
                await request_rate_limit.enforce_rate_limit(
                    {},
                    Request('198.51.100.10'),
                    policy,
                    now_unix=125,
                )

        self.assertEqual(context.exception.retry_after_seconds, 55)
        params = fetch_one.await_args.args[2]
        self.assertEqual(params[0], 'test')
        self.assertEqual(params[2], 120)
        self.assertNotEqual(params[1], '198.51.100.10')

    async def test_request_below_limit_passes(self) -> None:
        with patch.object(request_rate_limit, 'fetch_one', AsyncMock(return_value={'requestCount': 2})):
            await request_rate_limit.enforce_rate_limit(
                {},
                Request('198.51.100.10'),
                request_rate_limit.RateLimitPolicy('test', maximum_requests=2, window_seconds=60),
                now_unix=125,
            )


if __name__ == '__main__':
    unittest.main()
