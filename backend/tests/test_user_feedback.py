import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault("workers", workers)

from services import user_feedback  # noqa: E402


class UserFeedbackTest(unittest.IsolatedAsyncioTestCase):
    async def test_submit_feedback_stores_valid_public_payload_anonymously(self) -> None:
        env = object()
        request = object()
        execute = AsyncMock()
        fetch_one = AsyncMock(side_effect=[{"id": 12}, {"createdAtUnix": 12345}])

        with (
            patch.object(user_feedback, "execute", execute),
            patch.object(user_feedback, "fetch_one", fetch_one),
        ):
            response = await user_feedback.submit_feedback(
                env,
                request,
                {
                    "rating": 5,
                    "message": "Catalog data looked correct.",
                    "pagePath": "/catalog",
                    "source": "feedback_button",
                },
            )

        self.assertEqual(response, {"feedback": {"id": 12, "rating": 5, "createdAtUnix": 12345}})
        self.assertEqual(execute.await_count, 2)
        self.assertIn("DELETE FROM user_feedback", execute.await_args_list[0].args[1])
        insert_call = execute.await_args_list[1]
        self.assertIn("INSERT INTO user_feedback (rating, message, page_path, source)", insert_call.args[1])
        self.assertEqual(
            insert_call.args[2],
            [5, "Catalog data looked correct.", "/catalog", "feedback_button"],
        )

    async def test_submit_feedback_does_not_store_authenticated_user_data(self) -> None:
        env = object()
        request = object()
        execute = AsyncMock()
        fetch_one = AsyncMock(side_effect=[{"id": 4}, {"createdAtUnix": 987}])

        with (
            patch.object(user_feedback, "execute", execute),
            patch.object(user_feedback, "fetch_one", fetch_one),
        ):
            await user_feedback.submit_feedback(
                env,
                request,
                {
                    "rating": "4",
                    "message": "Planner worked, but the wording was unclear.",
                    "pagePath": "/planner",
                    "source": "auto_prompt",
                },
            )

        self.assertEqual(
            execute.await_args.args[2],
            [4, "Planner worked, but the wording was unclear.", "/planner", "auto_prompt"],
        )

    async def test_submit_feedback_rejects_invalid_rating_and_empty_message(self) -> None:
        with self.assertRaisesRegex(user_feedback.FeedbackSubmissionError, "rating"):
            await user_feedback.submit_feedback(
                object(),
                object(),
                {"rating": 6, "message": "Useful feedback", "pagePath": "/", "source": "feedback_button"},
            )

        with self.assertRaisesRegex(user_feedback.FeedbackSubmissionError, "message"):
            await user_feedback.submit_feedback(
                object(),
                object(),
                {"rating": 3, "message": "  ", "pagePath": "/", "source": "feedback_button"},
            )


if __name__ == "__main__":
    unittest.main()
