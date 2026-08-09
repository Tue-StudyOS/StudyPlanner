import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

import http_utils  # noqa: E402
import router  # noqa: E402


class CapturedResponse:
    """Stands in for the Workers Response so status and headers stay inspectable.

    The shared `workers` stub is registered by whichever test module imports
    first, so this is patched onto http_utils rather than onto that stub.
    """

    def __init__(self, body: object = None, **kwargs: object) -> None:
        self.body = body
        self.kwargs = kwargs


class FakeHeaders:
    def __init__(self, values: dict[str, str]) -> None:
        self._values = {key.lower(): value for key, value in values.items()}

    def get(self, name: str) -> str | None:
        return self._values.get(name.lower())


class FakeRequest:
    def __init__(self, method: str, path: str, headers: dict[str, str] | None = None) -> None:
        self.method = method
        self.url = f"https://api.example.com{path}"
        self.headers = FakeHeaders(headers or {})


ENV = {"ALLOWED_ORIGINS": "https://app.example.com"}


class CourseReviewRouteTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        response_patch = patch.object(http_utils, "Response", CapturedResponse)
        response_patch.start()
        self.addCleanup(response_patch.stop)

    async def test_reviews_path_is_matched_before_the_catalog_detail_route(self) -> None:
        """The detail branch is a prefix match and would otherwise swallow it."""
        get_reviews = AsyncMock(return_value={"summary": {"count": 0}})
        get_detail = AsyncMock(return_value={"id": "5"})

        with (
            patch.object(router, "get_course_reviews", get_reviews),
            patch.object(router, "get_catalog_course_detail", get_detail),
        ):
            await router.route_request(
                FakeRequest("GET", "/api/catalog/courses/5/reviews"),
                ENV,
            )

        get_reviews.assert_awaited_once()
        self.assertEqual(get_reviews.await_args.args[2], 5)
        get_detail.assert_not_awaited()

    async def test_public_reviews_read_is_not_edge_cached(self) -> None:
        """A 15-minute edge cache would hide a review right after it is written."""
        with patch.object(router, "get_course_reviews", AsyncMock(return_value={})):
            response = await router.route_request(
                FakeRequest("GET", "/api/catalog/courses/5/reviews"),
                ENV,
            )

        headers = {key.lower(): value for key, value in response.kwargs.get("headers", {}).items()}
        self.assertNotIn("cache-control", headers)

    async def test_non_numeric_course_id_is_rejected(self) -> None:
        get_reviews = AsyncMock()

        with patch.object(router, "get_course_reviews", get_reviews):
            response = await router.route_request(
                FakeRequest("GET", "/api/catalog/courses/abc/reviews"),
                ENV,
            )

        get_reviews.assert_not_awaited()
        self.assertEqual(response.kwargs.get("status"), 400)

    async def test_writing_a_review_requires_csrf_and_enforces_the_rate_limit(self) -> None:
        require_csrf = AsyncMock()
        enforce_rate_limit = AsyncMock()
        save_review = AsyncMock(return_value={})

        with (
            patch.object(router, "require_csrf_protection", require_csrf),
            patch.object(router, "enforce_rate_limit", enforce_rate_limit),
            patch.object(router, "save_course_review", save_review),
            patch.object(router, "read_json_object", AsyncMock(return_value={"overallRating": 5})),
        ):
            await router.route_request(FakeRequest("PUT", "/api/me/course-reviews/5"), ENV)

        require_csrf.assert_awaited_once()
        self.assertIs(enforce_rate_limit.await_args.args[2], router.COURSE_REVIEW_POLICY)
        self.assertEqual(save_review.await_args.args[2], 5)

    async def test_deleting_a_review_requires_csrf(self) -> None:
        require_csrf = AsyncMock()
        delete_review = AsyncMock(return_value={})

        with (
            patch.object(router, "require_csrf_protection", require_csrf),
            patch.object(router, "delete_course_review", delete_review),
        ):
            await router.route_request(FakeRequest("DELETE", "/api/me/course-reviews/5"), ENV)

        require_csrf.assert_awaited_once()
        delete_review.assert_awaited_once()

    async def test_moderation_writes_are_csrf_protected_too(self) -> None:
        """/api/admin/ is outside the /api/me/ prefix the blanket rule started with."""
        require_csrf = AsyncMock()
        set_visibility = AsyncMock(return_value={})

        with (
            patch.object(router, "require_csrf_protection", require_csrf),
            patch.object(router, "set_review_visibility", set_visibility),
            patch.object(router, "read_json_object", AsyncMock(return_value={"isHidden": True})),
        ):
            await router.route_request(FakeRequest("PATCH", "/api/admin/course-reviews/7"), ENV)

        require_csrf.assert_awaited_once()
        self.assertEqual(set_visibility.await_args.args[2], 7)

    async def test_public_notice_is_rate_limited_and_returns_a_receipt(self) -> None:
        enforce_rate_limit = AsyncMock()
        submit_notice = AsyncMock(return_value={'notice': {'reference': 'RN-9'}})
        with (
            patch.object(router, 'enforce_rate_limit', enforce_rate_limit),
            patch.object(router, 'submit_review_notice', submit_notice),
            patch.object(router, 'read_json_object', AsyncMock(return_value={'reviewId': 7})),
        ):
            response = await router.route_request(
                FakeRequest('POST', '/api/course-review-notices'),
                ENV,
            )

        self.assertIs(enforce_rate_limit.await_args.args[2], router.REVIEW_NOTICE_POLICY)
        submit_notice.assert_awaited_once()
        self.assertEqual(response.kwargs.get('status'), 201)

    async def test_notice_decision_is_csrf_protected(self) -> None:
        require_csrf = AsyncMock()
        decide_notice = AsyncMock(return_value={'id': 9, 'status': 'resolved'})
        with (
            patch.object(router, 'require_csrf_protection', require_csrf),
            patch.object(router, 'decide_review_notice', decide_notice),
            patch.object(router, 'read_json_object', AsyncMock(return_value={'action': 'keep'})),
        ):
            await router.route_request(
                FakeRequest('PATCH', '/api/admin/review-notices/9'),
                ENV,
            )

        require_csrf.assert_awaited_once()
        self.assertEqual(decide_notice.await_args.args[2], 9)

    async def test_review_errors_map_to_their_status_codes(self) -> None:
        cases = [
            (router.CourseReviewError("bad input"), 400),
            (router.CourseReviewNotFoundError("missing"), 404),
            (router.CourseReviewAccessError("not an operator"), 403),
        ]

        for error, expected_status in cases:
            with (
                self.subTest(error=type(error).__name__),
                patch.object(router, "get_course_reviews", AsyncMock(side_effect=error)),
            ):
                response = await router.route_request(
                    FakeRequest("GET", "/api/catalog/courses/5/reviews"),
                    ENV,
                )
                self.assertEqual(response.kwargs.get("status"), expected_status)

    async def test_reviews_route_rejects_other_methods(self) -> None:
        response = await router.route_request(
            FakeRequest("POST", "/api/catalog/courses/5/reviews"),
            ENV,
        )

        self.assertEqual(response.kwargs.get("status"), 405)


if __name__ == "__main__":
    unittest.main()
