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

from services import user_completed_courses  # noqa: E402
from services.user_completed_courses import (  # noqa: E402
    CompletedCoursePayload,
    CompletedCourseUpdateError,
    _normalize_course_source,
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


class CourseSourceNormalizationTest(unittest.TestCase):
    def test_legacy_transcript_ids_restore_the_source_marker(self) -> None:
        self.assertEqual(_normalize_course_source(None, 'import-old-row'), 'transcript_import')
        self.assertEqual(_normalize_course_source('transcript', 'stored-row'), 'transcript_import')
        self.assertEqual(_normalize_course_source('manual', 'manual-row'), 'manual')


class TranscriptReimportTest(unittest.IsolatedAsyncioTestCase):
    async def test_existing_transcript_course_is_updated_without_clearing_account_data(self) -> None:
        existing_course = {
            'id': 'import-old-row',
            'courseId': None,
            'externalCourseCode': None,
            'title': 'Abstracted course',
            'ects': 6.0,
            'masterCat': 'BASIS',
            'studyAreaCode': None,
            'grade': 2.0,
            'semester': 'SS 2024',
            'source': 'transcript_import',
            'createdAtUnix': 10,
            'updatedAtUnix': 10,
        }
        persist = AsyncMock()

        with (
            patch.object(user_completed_courses, 'require_authenticated_user', AsyncMock(return_value={
                'username': 'test',
                'profile': {'regulationVersionId': None},
            })),
            patch.object(user_completed_courses, '_load_rule_groups_for_regulation', AsyncMock(return_value={})),
            patch.object(user_completed_courses, '_load_course_rule_group_options', AsyncMock(return_value={})),
            patch.object(user_completed_courses, '_load_stored_completed_courses', AsyncMock(return_value=[existing_course])),
            patch.object(user_completed_courses, '_persist_stored_completed_courses', persist),
            patch.object(user_completed_courses, '_serialize_completed_courses', AsyncMock(return_value=[])),
            patch.object(user_completed_courses, '_now_unix', return_value=20),
        ):
            result = await user_completed_courses.import_current_user_completed_courses(
                {},
                object(),
                {
                    'imports': [{
                        'id': 'candidate-1',
                        'course': {
                            **existing_course,
                            'masterCat': 'INFO',
                            'source': 'transcript_import',
                        },
                    }],
                },
            )

        self.assertEqual(result['importedCount'], 1)
        self.assertEqual(result['skippedDuplicateCount'], 0)
        persisted_courses = persist.await_args.args[2]
        self.assertEqual(len(persisted_courses), 1)
        self.assertEqual(persisted_courses[0]['masterCat'], 'INFO')
        self.assertEqual(persisted_courses[0]['id'], 'import-old-row')
        self.assertEqual(persisted_courses[0]['updatedAtUnix'], 20)


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
