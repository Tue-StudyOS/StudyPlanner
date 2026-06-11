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

from services import user_favorites  # noqa: E402


class UserFavoritesTest(unittest.IsolatedAsyncioTestCase):
    async def test_load_favorites_prunes_stale_course_ids(self) -> None:
        env = object()
        load_user_state_json = AsyncMock(return_value='["1107", "42", "42", "not-a-number", "99"]')
        fetch_all = AsyncMock(return_value=[{"id": 42}, {"id": 99}])
        update_user_state_json = AsyncMock()

        with (
            patch.object(user_favorites, "load_user_state_json", load_user_state_json),
            patch.object(user_favorites, "fetch_all", fetch_all),
            patch.object(user_favorites, "update_user_state_json", update_user_state_json),
        ):
            favorite_course_ids = await user_favorites._list_favorite_course_ids(env, "alice")

        self.assertEqual(favorite_course_ids, ["42", "99"])
        update_user_state_json.assert_awaited_once_with(
            env,
            "alice",
            "favorites_json",
            ["42", "99"],
        )

    async def test_replace_favorites_ignores_unknown_numeric_course_ids(self) -> None:
        env = object()
        request = object()
        require_authenticated_user = AsyncMock(return_value={"username": "alice"})
        fetch_all = AsyncMock(return_value=[{"id": 42}])
        update_user_state_json = AsyncMock()
        list_favorite_course_ids = AsyncMock(return_value=["42"])

        with (
            patch.object(user_favorites, "require_authenticated_user", require_authenticated_user),
            patch.object(user_favorites, "fetch_all", fetch_all),
            patch.object(user_favorites, "update_user_state_json", update_user_state_json),
            patch.object(user_favorites, "_list_favorite_course_ids", list_favorite_course_ids),
        ):
            response = await user_favorites.replace_current_user_favorites(
                env,
                request,
                {"favoriteCourseIds": ["1107", "42", "1125"]},
            )

        self.assertEqual(response, {"favoriteCourseIds": ["42"], "count": 1})
        update_user_state_json.assert_awaited_once_with(
            env,
            "alice",
            "favorites_json",
            ["42"],
        )

    async def test_replace_favorites_rejects_non_numeric_course_ids(self) -> None:
        with self.assertRaisesRegex(user_favorites.FavoriteUpdateError, "must be numeric"):
            user_favorites._normalize_course_ids({"favoriteCourseIds": ["42", "not-a-number"]})


if __name__ == "__main__":
    unittest.main()
