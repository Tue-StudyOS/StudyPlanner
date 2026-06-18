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

from services.user_completed_courses import (  # noqa: E402
    CompletedCoursePayload,
    CompletedCourseUpdateError,
    _resolve_assignment,
)

# Mirrors the live BSC_INFO_2021 rule groups (real German group types).
RULE_GROUPS = {
    "INF": {"code": "INF", "name": "Pflichtstudienbereich Informatik", "groupType": "pflicht"},
    "PRAK": {"code": "PRAK", "name": "Wahlpflichtfach Praktische Informatik", "groupType": "wahlpflicht"},
    "TECH": {"code": "TECH", "name": "Wahlpflichtfach Technische Informatik", "groupType": "wahlpflicht"},
    "THEO": {"code": "THEO", "name": "Wahlpflichtfach Theoretische Informatik", "groupType": "wahlpflicht"},
    "INFO": {"code": "INFO", "name": "Wahlpflichtfach Informatik", "groupType": "wahlpflicht"},
    "UEBK": {"code": "UEBK", "name": "Ueberfachliche Kompetenzen", "groupType": "free_choice"},
    "THESIS": {"code": "THESIS", "name": "Bachelorarbeit incl. Vortrag", "groupType": "thesis"},
}


class ResolveAssignmentTest(unittest.TestCase):
    def test_catalog_matched_course_may_use_unmapped_compulsory_area(self) -> None:
        course = CompletedCoursePayload(masterCat="BASIS", studyAreaCode="INF", courseId=123)

        study_area_code, master_cat, _, _ = _resolve_assignment(course, [], RULE_GROUPS)

        self.assertEqual(study_area_code, "INF")
        self.assertEqual(master_cat, "BASIS")

    def test_anonymous_external_row_cannot_use_compulsory_area(self) -> None:
        course = CompletedCoursePayload(masterCat="BASIS", studyAreaCode="INF", courseId=None)

        with self.assertRaises(CompletedCourseUpdateError):
            _resolve_assignment(course, [], RULE_GROUPS)

    def test_flexible_area_selection_is_accepted_without_a_catalog_course(self) -> None:
        course = CompletedCoursePayload(masterCat="PRAK", studyAreaCode="PRAK", courseId=None)

        study_area_code, master_cat, _, _ = _resolve_assignment(course, [], RULE_GROUPS)

        self.assertEqual(study_area_code, "PRAK")
        self.assertEqual(master_cat, "PRAK")

    def test_explicit_selection_wins_over_a_single_flexible_fallback(self) -> None:
        # A BASIS course auto-resolves to ÜBK without a selection; the explicit
        # compulsory selection from the transcript section must take priority.
        course = CompletedCoursePayload(masterCat="BASIS", studyAreaCode="INF", courseId=7)

        study_area_code, _, _, _ = _resolve_assignment(course, [], RULE_GROUPS)

        self.assertEqual(study_area_code, "INF")

    def test_unknown_selected_area_is_rejected(self) -> None:
        course = CompletedCoursePayload(masterCat="INFO", studyAreaCode="NOT_A_REAL_AREA", courseId=9)

        with self.assertRaises(CompletedCourseUpdateError):
            _resolve_assignment(course, [], RULE_GROUPS)

    def test_mapped_selection_in_assignable_set_is_accepted(self) -> None:
        course = CompletedCoursePayload(masterCat="THEO", studyAreaCode="THEO", courseId=11)
        mapped_options = [
            {"studyAreaCode": "THEO", "studyAreaName": "Wahlpflichtfach Theoretische Informatik", "groupType": "wahlpflicht"},
        ]

        study_area_code, master_cat, _, _ = _resolve_assignment(course, mapped_options, RULE_GROUPS)

        self.assertEqual(study_area_code, "THEO")
        self.assertEqual(master_cat, "THEO")


if __name__ == "__main__":
    unittest.main()
