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
    return {
        "id": f"{study_area_code}:{ects}:{grade}",
        "ects": ects,
        "grade": grade,
        "studyAreaCode": study_area_code,
        "courseNumber": f"{study_area_code}:{ects}:{grade}",
    }


class ComputeAverageGradeTest(unittest.TestCase):
    def test_weights_by_ects_not_a_plain_mean(self) -> None:
        # Plain mean would be 2.0; ECTS weighting pulls it toward the 9 ECTS course.
        courses = [_course(3, 3.0), _course(9, 1.0)]
        expected = (3 * 3.0 + 9 * 1.0) / (3 + 9)
        self.assertAlmostEqual(_compute_average_grade(courses), expected)

    def test_informatik_uebk_module_grades_are_included(self) -> None:
        courses = [_course(6, 1.0, "INFO"), _course(6, 4.0, "uebk")]
        self.assertEqual(_compute_average_grade(courses, "BSC_INFO_2021"), 2.5)

    def test_returns_none_without_graded_courses(self) -> None:
        self.assertIsNone(_compute_average_grade([_course(6, None, "INFO")]))

    def test_does_not_invent_unweighted_grade_when_ects_are_missing(self) -> None:
        courses = [_course(0, 2.0, "INFO"), _course(0, 4.0, "INFO")]
        self.assertIsNone(_compute_average_grade(courses, "BSC_INFO_2021"))

    def test_basis_declaration_selects_basis_instead_of_focus(self) -> None:
        courses = [_course(18, 1.0, 'INFO-BASIS'), _course(18, 4.0, 'INFO-FOKUS')]
        self.assertEqual(_compute_average_grade(courses, 'MSC_INFO_2021'), 4.0)
        self.assertEqual(_compute_average_grade(
            courses, 'MSC_INFO_2021', {'mscInfoBasisAdmissionConfirmed': True},
        ), 1.0)

    def test_ml_exp_is_excluded_and_result_truncated(self) -> None:
        courses = [_course(6, 1.0, "ML-CS"), _course(6, 4.0, "ML-EXP")]
        self.assertEqual(_compute_average_grade(courses, "MSC_ML_2021"), 1.0)
        self.assertEqual(_compute_average_grade([_course(6, 1.99, "ML-CS")], "MSC_ML_2021"), 1.9)


if __name__ == "__main__":
    unittest.main()
