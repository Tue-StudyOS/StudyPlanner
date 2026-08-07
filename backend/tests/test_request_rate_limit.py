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


class FailedAttemptLimitTest(unittest.IsolatedAsyncioTestCase):
    POLICY = request_rate_limit.RateLimitPolicy('test', maximum_requests=2, window_seconds=60)

    def test_two_accounts_behind_one_ip_get_separate_budgets(self) -> None:
        request = Request('198.51.100.10')

        first_key = request_rate_limit._account_key(request, 'ada@example.com')
        second_key = request_rate_limit._account_key(request, 'grace@example.com')

        self.assertNotEqual(first_key, second_key)
        self.assertNotEqual(first_key, request_rate_limit._client_key(request))

    def test_account_key_ignores_case_and_surrounding_whitespace(self) -> None:
        request = Request('198.51.100.10')

        self.assertEqual(
            request_rate_limit._account_key(request, '  Ada@Example.com '),
            request_rate_limit._account_key(request, 'ada@example.com'),
        )

    def test_missing_identifier_falls_back_to_the_client_ip(self) -> None:
        request = Request('198.51.100.10')

        self.assertEqual(
            request_rate_limit._account_key(request, None),
            request_rate_limit._client_key(request),
        )

    async def test_checking_the_limit_does_not_consume_budget(self) -> None:
        fetch_one = AsyncMock(return_value={'requestCount': 1})

        with patch.object(request_rate_limit, 'fetch_one', fetch_one):
            await request_rate_limit.enforce_failed_attempt_limit(
                {},
                Request('198.51.100.10'),
                self.POLICY,
                identifier='ada@example.com',
                now_unix=125,
            )

        # A successful login, or one that 5xx'd inside the Worker, must leave the
        # window untouched — so the check may only ever read.
        self.assertIn('SELECT', fetch_one.await_args.args[1])
        self.assertNotIn('INSERT', fetch_one.await_args.args[1])

    async def test_limit_is_reached_once_the_window_is_full_of_failures(self) -> None:
        with patch.object(request_rate_limit, 'fetch_one', AsyncMock(return_value={'requestCount': 2})):
            with self.assertRaises(request_rate_limit.RateLimitError) as context:
                await request_rate_limit.enforce_failed_attempt_limit(
                    {},
                    Request('198.51.100.10'),
                    self.POLICY,
                    identifier='ada@example.com',
                    now_unix=125,
                )

        self.assertEqual(context.exception.retry_after_seconds, 55)

    async def test_recording_a_failure_charges_the_account_window(self) -> None:
        request = Request('198.51.100.10')
        fetch_one = AsyncMock(return_value={'requestCount': 1})

        with patch.object(request_rate_limit, 'fetch_one', fetch_one):
            await request_rate_limit.record_failed_attempt(
                {},
                request,
                self.POLICY,
                identifier='ada@example.com',
                now_unix=125,
            )

        self.assertIn('INSERT', fetch_one.await_args.args[1])
        params = fetch_one.await_args.args[2]
        self.assertEqual(params[0], 'test')
        self.assertEqual(params[1], request_rate_limit._account_key(request, 'ada@example.com'))
        self.assertEqual(params[2], 120)

    async def test_a_stale_window_row_does_not_count_against_the_current_window(self) -> None:
        fetch_one = AsyncMock(return_value=None)

        with patch.object(request_rate_limit, 'fetch_one', fetch_one):
            await request_rate_limit.enforce_failed_attempt_limit(
                {},
                Request('198.51.100.10'),
                self.POLICY,
                identifier='ada@example.com',
                now_unix=125,
            )

        self.assertEqual(fetch_one.await_args.args[2][2], 120)


if __name__ == '__main__':
    unittest.main()
