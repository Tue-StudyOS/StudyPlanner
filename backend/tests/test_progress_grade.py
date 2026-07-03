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

from services.progress import _compute_average_grade  # noqa: E402


def _course(ects: float, grade: float | None, study_area_code: str | None = None) -> dict:
    return {"ects": ects, "grade": grade, "studyAreaCode": study_area_code}


class ComputeAverageGradeTest(unittest.TestCase):
    def test_weights_by_ects_not_a_plain_mean(self) -> None:
        # Plain mean would be 2.0; ECTS weighting pulls it toward the 9 ECTS course.
        courses = [_course(3, 3.0), _course(9, 1.0)]
        expected = (3 * 3.0 + 9 * 1.0) / (3 + 9)
        self.assertAlmostEqual(_compute_average_grade(courses), expected)

    def test_excludes_uebk_case_insensitively(self) -> None:
        courses = [_course(6, 1.0, "INFO"), _course(6, 4.0, "uebk")]
        self.assertAlmostEqual(_compute_average_grade(courses), 1.0)

    def test_returns_none_without_graded_courses(self) -> None:
        self.assertIsNone(_compute_average_grade([_course(6, None, "INFO")]))

    def test_falls_back_to_unweighted_mean_without_ects(self) -> None:
        courses = [_course(0, 2.0, "INFO"), _course(0, 4.0, "INFO")]
        self.assertAlmostEqual(_compute_average_grade(courses), 3.0)


if __name__ == "__main__":
    unittest.main()
