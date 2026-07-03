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

from services import user_semester_plans  # noqa: E402


class NormalizeParallelGroupsTest(unittest.TestCase):
    def test_keeps_positive_integer_positions(self) -> None:
        result = user_semester_plans._normalize_course_parallel_groups(
            {"courseParallelGroups": {"42": 2, "99": "1"}}
        )
        self.assertEqual(result, {"42": 2, "99": 1})

    def test_drops_invalid_positions(self) -> None:
        result = user_semester_plans._normalize_course_parallel_groups(
            {"courseParallelGroups": {"42": 0, "99": -1, "7": "x", "8": None}}
        )
        self.assertEqual(result, {})

    def test_ignores_non_dict_payload(self) -> None:
        self.assertEqual(user_semester_plans._normalize_course_parallel_groups({}), {})
        self.assertEqual(
            user_semester_plans._normalize_course_parallel_groups(
                {"courseParallelGroups": []}
            ),
            {},
        )

    def test_stored_selections_scoped_to_plan_course_ids(self) -> None:
        result = user_semester_plans._normalize_stored_parallel_groups(
            {"42": 2, "99": 1, "500": 3}, ["42", "99"]
        )
        self.assertEqual(result, {"42": 2, "99": 1})


class ValidateParallelGroupsTest(unittest.IsolatedAsyncioTestCase):
    async def test_keeps_only_existing_course_group_pairs(self) -> None:
        env = object()
        fetch_all = AsyncMock(
            return_value=[
                {"course_id": 42, "position": 1},
                {"course_id": 42, "position": 2},
                {"course_id": 99, "position": 1},
            ]
        )
        with patch.object(user_semester_plans, "fetch_all", fetch_all):
            result = await user_semester_plans._validate_course_parallel_groups(
                env,
                [42, 99],
                {"42": 2, "99": 3},  # 99->3 does not exist
            )
        # 42->2 is a real group; 99->3 is dropped so the calendar falls back.
        self.assertEqual(result, {"42": 2})

    async def test_no_selections_skips_query(self) -> None:
        fetch_all = AsyncMock()
        with patch.object(user_semester_plans, "fetch_all", fetch_all):
            result = await user_semester_plans._validate_course_parallel_groups(
                object(), [42], {}
            )
        self.assertEqual(result, {})
        fetch_all.assert_not_awaited()


if __name__ == "__main__":
    unittest.main()
