import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

from services.ai_catalog import (  # noqa: E402
    parse_search_payload,
    summarize_course_for_ai,
)


class ParseSearchPayloadTest(unittest.TestCase):
    def test_defaults_and_clamping(self) -> None:
        options = parse_search_payload({})
        self.assertEqual(options, {"query": None, "limit": 10, "period_id": "all"})
        self.assertEqual(parse_search_payload({"limit": 999})["limit"], 25)
        self.assertEqual(parse_search_payload({"limit": 0})["limit"], 1)

    def test_rejects_invalid_types(self) -> None:
        with self.assertRaises(ValueError):
            parse_search_payload({"query": 5})
        with self.assertRaises(ValueError):
            parse_search_payload({"limit": "many"})
        with self.assertRaises(ValueError):
            parse_search_payload({"periodId": 7})


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
