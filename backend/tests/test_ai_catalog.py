import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

from services.ai_catalog import (  # noqa: E402
    build_ai_meta,
    course_matches_ai_filters,
    parse_search_payload,
    pick_resolved_course,
    resolve_public_ai_base_url,
    summarize_course_for_ai,
)


class PublicAiBaseUrlTest(unittest.TestCase):
    def test_uses_public_gateway_for_non_local_requests(self) -> None:
        self.assertEqual(resolve_public_ai_base_url("https://worker.example"), "https://studyplaner.pages.dev")
        self.assertEqual(build_ai_meta("https://worker.example")["openapiUrl"], "https://studyplaner.pages.dev/api/ai/openapi.json")
        self.assertEqual(build_ai_meta("https://worker.example")["privacyUrl"], "https://studyplaner.pages.dev/privacy")

    def test_keeps_localhost_for_local_development(self) -> None:
        self.assertEqual(resolve_public_ai_base_url("http://localhost:8789"), "http://localhost:8789")


class ParseSearchPayloadTest(unittest.TestCase):
    def test_defaults_and_clamping(self) -> None:
        options = parse_search_payload({})
        self.assertEqual(options["query"], None)
        self.assertEqual(options["limit"], 10)
        self.assertEqual(options["period_id"], "all")
        self.assertEqual(parse_search_payload({"limit": 999})["limit"], 25)
        self.assertEqual(parse_search_payload({"limit": 0})["limit"], 1)

    def test_rejects_invalid_types(self) -> None:
        with self.assertRaises(ValueError):
            parse_search_payload({"query": 5})
        with self.assertRaises(ValueError):
            parse_search_payload({"limit": "many"})
        with self.assertRaises(ValueError):
            parse_search_payload({"periodId": 7})

    def test_parses_structured_filters(self) -> None:
        filters = parse_search_payload(
            {
                "ects": {"min": 3, "max": 9},
                "weekdays": ["Montag", "wed"],
                "timeWindow": {"start": "10:00", "end": "16:00"},
                "courseTypes": ["Lecture"],
                "studyAreaCodes": ["info-theo"],
                "termTypes": ["Summer"],
            }
        )["filters"]
        self.assertEqual(filters["ects_min"], 3.0)
        self.assertEqual(filters["weekdays"], ["monday", "wednesday"])
        self.assertEqual(filters["time_start"], 600)
        self.assertEqual(filters["time_end"], 960)
        self.assertEqual(filters["course_types"], ["lecture"])
        self.assertEqual(filters["study_area_codes"], ["INFO-THEO"])
        self.assertEqual(filters["term_types"], ["summer"])

    def test_rejects_invalid_filter_shapes(self) -> None:
        with self.assertRaises(ValueError):
            parse_search_payload({"timeWindow": {"start": "25h"}})
        with self.assertRaises(ValueError):
            parse_search_payload({"weekdays": "Monday"})
        with self.assertRaises(ValueError):
            parse_search_payload({"ects": {"min": "lots"}})


class CourseMatchesFiltersTest(unittest.TestCase):
    def _summary(self, **overrides: object) -> dict:
        base = {
            "ects": 6,
            "termType": "summer",
            "types": ["Vorlesung"],
            "studyAreaCodes": ["INFO-THEO"],
            "schedule": [{"day": "Mo", "time": "10:00 - 12:00"}],
        }
        base.update(overrides)
        return base

    def _filters(self, **overrides: object) -> dict:
        return parse_search_payload(overrides)["filters"]

    def test_ects_range_excludes_courses_without_ects(self) -> None:
        self.assertTrue(course_matches_ai_filters(self._summary(), self._filters(ects={"min": 3, "max": 9})))
        self.assertFalse(course_matches_ai_filters(self._summary(ects=12), self._filters(ects={"max": 9})))
        self.assertFalse(course_matches_ai_filters(self._summary(ects=None), self._filters(ects={"min": 1})))

    def test_term_both_matches_any_single_term(self) -> None:
        self.assertTrue(course_matches_ai_filters(self._summary(termType="both"), self._filters(termTypes=["winter"])))
        self.assertFalse(course_matches_ai_filters(self._summary(termType="winter"), self._filters(termTypes=["summer"])))

    def test_weekday_and_time_window(self) -> None:
        self.assertTrue(course_matches_ai_filters(self._summary(), self._filters(weekdays=["Monday"])))
        self.assertFalse(course_matches_ai_filters(self._summary(), self._filters(weekdays=["Friday"])))
        self.assertTrue(course_matches_ai_filters(self._summary(), self._filters(timeWindow={"start": "09:00", "end": "13:00"})))
        self.assertFalse(course_matches_ai_filters(self._summary(), self._filters(timeWindow={"start": "11:00", "end": "13:00"})))

    def test_study_area_and_course_type(self) -> None:
        self.assertTrue(course_matches_ai_filters(self._summary(), self._filters(studyAreaCodes=["INFO-THEO"])))
        self.assertFalse(course_matches_ai_filters(self._summary(), self._filters(studyAreaCodes=["ML-FOUND"])))
        self.assertTrue(course_matches_ai_filters(self._summary(), self._filters(courseTypes=["vorlesung"])))
        self.assertFalse(course_matches_ai_filters(self._summary(), self._filters(courseTypes=["seminar"])))


class ResolveCourseTest(unittest.TestCase):
    def test_prefers_exact_number_then_title_hint(self) -> None:
        summaries = [
            {"courseId": "1", "courseNumber": "INFM999", "title": "Other"},
            {"courseId": "2", "courseNumber": "INFM1234", "title": "Machine Learning"},
            {"courseId": "3", "courseNumber": "INFM1234", "title": "Machine Learning Lab"},
        ]
        self.assertEqual(pick_resolved_course(summaries, "INFM1234", None)["courseId"], "2")
        self.assertEqual(pick_resolved_course(summaries, "INFM1234", "lab")["courseId"], "3")
        self.assertIsNone(pick_resolved_course([], "INFM1234", None))


class SummarizeCourseTest(unittest.TestCase):
    def test_projects_compact_fields(self) -> None:
        summary = summarize_course_for_ai(
            {
                "id": "42",
                "number": "INFM1010",
                "title": "Machine Learning",
                "periodLabel": "Sommer 2026",
                "offeredPeriods": ["Sommer 2026"],
                "termType": "summer",
                "ects": 6,
                "lecturer": "Prof. Example",
                "types": ["Vorlesung"],
                "studyAreaOptions": [
                    {"studyAreaCode": "INFO-THEO"},
                    {"studyAreaCode": "INFO-THEO"},
                    {"studyAreaCode": None},
                ],
                "schedule": [],
                "detailUrl": "",
                "rawFieldsJson": "should not leak",
            }
        )

        self.assertEqual(summary["courseId"], "42")
        self.assertEqual(summary["studyAreaCodes"], ["INFO-THEO"])
        self.assertIsNone(summary["detailUrl"])
        self.assertNotIn("rawFieldsJson", summary)


if __name__ == "__main__":
    unittest.main()
