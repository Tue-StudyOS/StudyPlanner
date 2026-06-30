import sys
import types
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")
workers.Response = object
sys.modules.setdefault("workers", workers)

from services.anrechnung_optimizer import optimize_anrechnung  # noqa: E402

RULE_GROUPS = [
    {"code": "TECH", "requiredEcts": 6.0},
    {"code": "THEO", "requiredEcts": 6.0},
]


class OptimizeAnrechnungTest(unittest.TestCase):
    def test_reassigns_flexible_course_to_cover_a_second_area(self) -> None:
        courses = [
            {"id": "a", "ects": 6.0, "grade": 2.0, "currentAreaCode": "TECH", "candidateAreaCodes": ["TECH"]},
            {"id": "b", "ects": 6.0, "grade": 2.0, "currentAreaCode": "TECH", "candidateAreaCodes": ["TECH", "THEO"]},
        ]
        result = optimize_anrechnung(courses, RULE_GROUPS)
        self.assertTrue(result["hasImprovement"])
        self.assertEqual(result["gainedAreas"], 1)
        self.assertEqual(result["after"]["coveredAreas"], 2)
        self.assertEqual(
            result["changes"],
            [{"completedCourseId": "b", "fromAreaCode": "TECH", "toAreaCode": "THEO"}],
        )

    def test_no_improvement_when_courses_are_locked(self) -> None:
        courses = [
            {"id": "a", "ects": 6.0, "grade": 1.0, "currentAreaCode": "TECH", "candidateAreaCodes": ["TECH"]},
            {"id": "b", "ects": 6.0, "grade": 1.0, "currentAreaCode": "THEO", "candidateAreaCodes": ["THEO"]},
        ]
        result = optimize_anrechnung(courses, RULE_GROUPS)
        self.assertFalse(result["hasImprovement"])
        self.assertEqual(result["changes"], [])

    def test_baseline_uses_first_candidate_when_no_current_area(self) -> None:
        courses = [
            {"id": "a", "ects": 6.0, "grade": None, "currentAreaCode": None, "candidateAreaCodes": ["THEO", "TECH"]},
        ]
        result = optimize_anrechnung(courses, RULE_GROUPS)
        self.assertEqual(result["baseline"]["a"], "THEO")

    def test_does_not_regress_already_optimal_assignment(self) -> None:
        courses = [
            {"id": "a", "ects": 6.0, "grade": 2.0, "currentAreaCode": "TECH", "candidateAreaCodes": ["TECH", "THEO"]},
            {"id": "b", "ects": 6.0, "grade": 2.0, "currentAreaCode": "THEO", "candidateAreaCodes": ["TECH", "THEO"]},
        ]
        result = optimize_anrechnung(courses, RULE_GROUPS)
        self.assertEqual(result["after"]["coveredAreas"], 2)
        self.assertFalse(result["hasImprovement"])


if __name__ == "__main__":
    unittest.main()
