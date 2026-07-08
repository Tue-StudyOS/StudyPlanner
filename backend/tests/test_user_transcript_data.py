import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, call, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault("workers", workers)

from services import user_transcript_data  # noqa: E402


class UserTranscriptDataTest(unittest.IsolatedAsyncioTestCase):
    async def test_clear_transcript_data_removes_completed_courses_and_review_items(self) -> None:
        env = object()
        request = object()
        require_authenticated_user = AsyncMock(return_value={"username": "alice"})
        update_user_progress_json = AsyncMock()

        with (
            patch.object(user_transcript_data, "require_authenticated_user", require_authenticated_user),
            patch.object(user_transcript_data, "update_user_progress_json", update_user_progress_json),
        ):
            response = await user_transcript_data.clear_current_user_transcript_data(env, request)

        self.assertEqual(
            response,
            {
                "completedCourses": [],
                "transcriptIssues": [],
                "completedCourseCount": 0,
                "transcriptIssueCount": 0,
            },
        )
        update_user_progress_json.assert_has_awaits(
            [
                call(env, "alice", "completed_courses_json", []),
                call(env, "alice", "transcript_review_items_json", []),
            ],
        )
        self.assertEqual(update_user_progress_json.await_count, 2)


if __name__ == "__main__":
    unittest.main()
