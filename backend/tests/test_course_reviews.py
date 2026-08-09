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

from services import course_reviews  # noqa: E402

OPTIONS = {
    "periodLabels": ["Winter 2025/26", "Sommer 2025"],
    "lecturers": ["Prof. Dr. Anna Beispiel", "Dr. Bernd Muster"],
}


def _review_row(**overrides: object) -> dict[str, object]:
    row = {
        "id": 1,
        "username": "student",
        "overallRating": 4,
        "examRating": None,
        "contentRating": None,
        "tutorialRating": None,
        "comment": None,
        "takenPeriodLabel": None,
        "lecturerName": None,
        "lecturerCustomName": None,
        "createdAtUnix": 100,
        "updatedAtUnix": 100,
    }
    row.update(overrides)
    return row


class BuildReviewInputTest(unittest.TestCase):
    def test_accepts_a_minimal_review_with_only_the_overall_rating(self) -> None:
        review_input = course_reviews.build_review_input({"overallRating": 5}, OPTIONS)

        self.assertEqual(review_input["overallRating"], 5)
        self.assertIsNone(review_input["examRating"])
        self.assertIsNone(review_input["comment"])
        self.assertIsNone(review_input["takenPeriodLabel"])
        self.assertIsNone(review_input["lecturerName"])
        self.assertIsNone(review_input["lecturerCustomName"])

    def test_rejects_out_of_range_ratings(self) -> None:
        with self.assertRaisesRegex(course_reviews.CourseReviewError, "overallRating"):
            course_reviews.build_review_input({"overallRating": 0}, OPTIONS)

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "overallRating"):
            course_reviews.build_review_input({"overallRating": 6}, OPTIONS)

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "tutorialRating"):
            course_reviews.build_review_input(
                {"overallRating": 3, "tutorialRating": 9},
                OPTIONS,
            )

    def test_treats_blank_optional_ratings_as_absent(self) -> None:
        review_input = course_reviews.build_review_input(
            {"overallRating": 3, "examRating": "", "contentRating": None, "tutorialRating": 2},
            OPTIONS,
        )

        self.assertIsNone(review_input["examRating"])
        self.assertIsNone(review_input["contentRating"])
        self.assertEqual(review_input["tutorialRating"], 2)

    def test_enforces_comment_length_bounds(self) -> None:
        with self.assertRaisesRegex(course_reviews.CourseReviewError, "at least"):
            course_reviews.build_review_input(
                {"overallRating": 3, "comment": "ok"},
                OPTIONS,
            )

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "at most"):
            course_reviews.build_review_input(
                {"overallRating": 3, "comment": "x" * (course_reviews.MAX_COMMENT_LENGTH + 1)},
                OPTIONS,
            )

        review_input = course_reviews.build_review_input(
            {"overallRating": 3, "comment": "   Well structured lecture.  "},
            OPTIONS,
        )
        self.assertEqual(review_input["comment"], "Well structured lecture.")

    def test_only_accepts_semesters_the_course_was_offered_in(self) -> None:
        review_input = course_reviews.build_review_input(
            {"overallRating": 4, "takenPeriodLabel": "sommer 2025"},
            OPTIONS,
        )
        self.assertEqual(review_input["takenPeriodLabel"], "Sommer 2025")

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "takenPeriodLabel"):
            course_reviews.build_review_input(
                {"overallRating": 4, "takenPeriodLabel": "Winter 1999/00"},
                OPTIONS,
            )

    def test_separates_a_known_lecturer_from_manually_typed_text(self) -> None:
        picked = course_reviews.build_review_input(
            {"overallRating": 4, "lecturerName": "dr. bernd muster"},
            OPTIONS,
        )
        self.assertEqual(picked["lecturerName"], "Dr. Bernd Muster")
        self.assertIsNone(picked["lecturerCustomName"])

        typed = course_reviews.build_review_input(
            {"overallRating": 4, "lecturerCustomName": "Dr. Neu Hinzu"},
            OPTIONS,
        )
        self.assertIsNone(typed["lecturerName"])
        self.assertEqual(typed["lecturerCustomName"], "Dr. Neu Hinzu")

    def test_rejects_unknown_picked_lecturer_both_fields_and_overlong_free_text(self) -> None:
        with self.assertRaisesRegex(course_reviews.CourseReviewError, "known lecturer"):
            course_reviews.build_review_input(
                {"overallRating": 4, "lecturerName": "Someone Else"},
                OPTIONS,
            )

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "not both"):
            course_reviews.build_review_input(
                {
                    "overallRating": 4,
                    "lecturerName": "Dr. Bernd Muster",
                    "lecturerCustomName": "Dr. Neu Hinzu",
                },
                OPTIONS,
            )

        with self.assertRaisesRegex(course_reviews.CourseReviewError, "lecturerCustomName"):
            course_reviews.build_review_input(
                {
                    "overallRating": 4,
                    "lecturerCustomName": "x" * (course_reviews.MAX_LECTURER_NAME_LENGTH + 1),
                },
                OPTIONS,
            )


class BuildReviewSummaryTest(unittest.TestCase):
    def test_returns_an_empty_summary_without_reviews(self) -> None:
        summary = course_reviews.build_review_summary([])

        self.assertIsNone(summary["average"])
        self.assertEqual(summary["count"], 0)
        self.assertEqual(summary["breakdown"], {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0})
        self.assertIsNone(summary["examAverage"])

    def test_averages_the_headline_rating_and_counts_each_star(self) -> None:
        summary = course_reviews.build_review_summary(
            [
                _review_row(overallRating=5),
                _review_row(overallRating=4),
                _review_row(overallRating=4),
            ]
        )

        self.assertEqual(summary["average"], 4.33)
        self.assertEqual(summary["count"], 3)
        self.assertEqual(summary["breakdown"]["4"], 2)
        self.assertEqual(summary["breakdown"]["5"], 1)

    def test_averages_each_sub_rating_over_only_the_reviews_that_gave_one(self) -> None:
        summary = course_reviews.build_review_summary(
            [
                _review_row(overallRating=5, examRating=2, tutorialRating=None),
                _review_row(overallRating=1, examRating=4, tutorialRating=3),
            ]
        )

        self.assertEqual(summary["average"], 3.0)
        self.assertEqual(summary["examAverage"], 3.0)
        self.assertEqual(summary["tutorialAverage"], 3.0)
        self.assertIsNone(summary["contentAverage"])


class PublicReviewShapeTest(unittest.IsolatedAsyncioTestCase):
    async def test_public_read_never_exposes_the_author_and_marks_the_viewers_own(self) -> None:
        rows = [
            _review_row(id=1, username="student", overallRating=5),
            _review_row(id=2, username="someone-else", overallRating=3),
        ]
        fetch_all = AsyncMock(return_value=rows)
        get_review_key = AsyncMock(return_value="inf-01")
        load_options = AsyncMock(return_value=OPTIONS)
        get_user = AsyncMock(return_value={"username": "student"})

        with (
            patch.object(course_reviews, "fetch_all", fetch_all),
            patch.object(course_reviews, "get_course_review_key", get_review_key),
            patch.object(course_reviews, "load_course_review_options", load_options),
            patch.object(course_reviews, "get_authenticated_user", get_user),
        ):
            response = await course_reviews.get_course_reviews(object(), object(), 42)

        self.assertEqual(response["summary"]["count"], 2)
        self.assertEqual(response["options"], OPTIONS)
        for review in response["reviews"]:
            self.assertNotIn("username", review)
        self.assertTrue(response["reviews"][0]["isMine"])
        self.assertFalse(response["reviews"][1]["isMine"])
        self.assertEqual(response["viewerReview"]["id"], 1)

    async def test_signed_out_read_owns_no_review(self) -> None:
        fetch_all = AsyncMock(return_value=[_review_row(id=1, username="student")])

        with (
            patch.object(course_reviews, "fetch_all", fetch_all),
            patch.object(course_reviews, "get_course_review_key", AsyncMock(return_value="inf-01")),
            patch.object(
                course_reviews, "load_course_review_options", AsyncMock(return_value=OPTIONS)
            ),
            patch.object(course_reviews, "get_authenticated_user", AsyncMock(return_value=None)),
        ):
            response = await course_reviews.get_course_reviews(object(), object(), 42)

        self.assertFalse(response["reviews"][0]["isMine"])
        self.assertIsNone(response["viewerReview"])

    async def test_hidden_reviews_are_excluded_by_the_read_query(self) -> None:
        fetch_all = AsyncMock(return_value=[])

        with (
            patch.object(course_reviews, "fetch_all", fetch_all),
            patch.object(course_reviews, "get_course_review_key", AsyncMock(return_value="inf-01")),
            patch.object(
                course_reviews, "load_course_review_options", AsyncMock(return_value=OPTIONS)
            ),
            patch.object(course_reviews, "get_authenticated_user", AsyncMock(return_value=None)),
        ):
            await course_reviews.get_course_reviews(object(), object(), 42)

        self.assertIn("is_hidden = 0", fetch_all.await_args.args[1])

    async def test_read_reports_a_missing_course_rather_than_an_empty_list(self) -> None:
        with (
            patch.object(course_reviews, "get_course_review_key", AsyncMock(return_value=None)),
            self.assertRaises(course_reviews.CourseReviewNotFoundError),
        ):
            await course_reviews.get_course_reviews(object(), object(), 999)


class SaveAndDeleteReviewTest(unittest.IsolatedAsyncioTestCase):
    async def test_save_upserts_on_the_one_review_per_person_constraint(self) -> None:
        execute = AsyncMock()

        with (
            patch.object(course_reviews, "execute", execute),
            patch.object(course_reviews, "fetch_all", AsyncMock(return_value=[])),
            patch.object(
                course_reviews,
                "require_authenticated_user",
                AsyncMock(return_value={"username": "student"}),
            ),
            patch.object(course_reviews, "get_authenticated_user", AsyncMock(return_value=None)),
            patch.object(course_reviews, "get_course_review_key", AsyncMock(return_value="inf-01")),
            patch.object(
                course_reviews, "load_course_review_options", AsyncMock(return_value=OPTIONS)
            ),
        ):
            await course_reviews.save_course_review(
                object(),
                object(),
                42,
                {
                    "overallRating": 5,
                    "contentRating": 4,
                    "comment": "Clear and well paced.",
                    "takenPeriodLabel": "Sommer 2025",
                    "lecturerCustomName": "Dr. Neu Hinzu",
                },
            )

        execute.assert_awaited_once()
        statement = execute.await_args.args[1]
        self.assertIn("ON CONFLICT(course_key, username) DO UPDATE SET", statement)
        self.assertEqual(
            execute.await_args.args[2],
            [
                "inf-01",
                "student",
                5,
                None,
                4,
                None,
                "Clear and well paced.",
                "Sommer 2025",
                None,
                "Dr. Neu Hinzu",
            ],
        )

    async def test_delete_only_targets_the_callers_own_row(self) -> None:
        execute = AsyncMock()

        with (
            patch.object(course_reviews, "execute", execute),
            patch.object(course_reviews, "fetch_all", AsyncMock(return_value=[])),
            patch.object(
                course_reviews,
                "require_authenticated_user",
                AsyncMock(return_value={"username": "student"}),
            ),
            patch.object(course_reviews, "get_authenticated_user", AsyncMock(return_value=None)),
            patch.object(course_reviews, "get_course_review_key", AsyncMock(return_value="inf-01")),
            patch.object(
                course_reviews, "load_course_review_options", AsyncMock(return_value=OPTIONS)
            ),
        ):
            await course_reviews.delete_course_review(object(), object(), 42)

        self.assertIn("WHERE course_key = ? AND username = ?", execute.await_args.args[1])
        self.assertEqual(execute.await_args.args[2], ["inf-01", "student"])


class ModerationTest(unittest.IsolatedAsyncioTestCase):
    async def test_non_operators_cannot_list_or_hide_reviews(self) -> None:
        with (
            patch.object(
                course_reviews,
                "require_authenticated_user",
                AsyncMock(return_value={"username": "student"}),
            ),
            patch.object(course_reviews, "is_diagnostics_administrator", lambda env, name: False),
            self.assertRaises(course_reviews.CourseReviewAccessError),
        ):
            await course_reviews.list_reviews_for_moderation(object(), object())

    async def test_operator_can_hide_an_existing_review(self) -> None:
        execute = AsyncMock()

        with (
            patch.object(course_reviews, "execute", execute),
            patch.object(course_reviews, "fetch_one", AsyncMock(return_value={"id": 7})),
            patch.object(
                course_reviews,
                "require_authenticated_user",
                AsyncMock(return_value={"username": "operator"}),
            ),
            patch.object(course_reviews, "is_diagnostics_administrator", lambda env, name: True),
            patch.object(course_reviews, "cleanup_expired_hidden_reviews", AsyncMock()),
        ):
            response = await course_reviews.set_review_visibility(
                object(), object(), 7, {"isHidden": True}
            )

        self.assertEqual(response, {"id": 7, "isHidden": True})
        self.assertEqual(execute.await_args.args[2], [1, 7])

    async def test_hiding_requires_a_boolean_and_an_existing_review(self) -> None:
        with (
            patch.object(
                course_reviews,
                "require_authenticated_user",
                AsyncMock(return_value={"username": "operator"}),
            ),
            patch.object(course_reviews, "is_diagnostics_administrator", lambda env, name: True),
            patch.object(course_reviews, "cleanup_expired_hidden_reviews", AsyncMock()),
        ):
            with self.assertRaisesRegex(course_reviews.CourseReviewError, "isHidden"):
                await course_reviews.set_review_visibility(
                    object(), object(), 7, {"isHidden": "yes"}
                )

            with (
                patch.object(course_reviews, "fetch_one", AsyncMock(return_value=None)),
                self.assertRaises(course_reviews.CourseReviewNotFoundError),
            ):
                await course_reviews.set_review_visibility(
                    object(), object(), 7, {"isHidden": True}
                )


if __name__ == "__main__":
    unittest.main()
