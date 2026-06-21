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

from services.progress import _is_math_compulsory_course  # noqa: E402


class IsMathCompulsoryCourseTest(unittest.TestCase):
    def test_recognizes_compulsory_math_modules_by_title(self) -> None:
        titles = [
            "INF1020-V Mathematik für Informatik 2: Lineare Algebra (früher Mathematik II) - Vorlesung",
            "Mathematik für Informatik 1: Analysis",
            "Mathematik fuer Informatik 3: Fortgeschrittene Themen",
            "Mathematics for Computer Science 1",
        ]
        for title in titles:
            self.assertTrue(
                _is_math_compulsory_course(title, "INF", 137, set()),
                msg=f"expected math match for: {title}",
            )

    def test_recognizes_legacy_math_study_area_and_mapped_ids(self) -> None:
        self.assertTrue(_is_math_compulsory_course("Some title", "MATH", None, set()))
        self.assertTrue(_is_math_compulsory_course("Some title", "INF", 42, {42}))

    def test_does_not_match_unrelated_or_adjacent_courses(self) -> None:
        non_math_titles = [
            "Diskrete Mathematik und Logik",
            "Theoretische Informatik 2: Formale Sprachen",
            "Linux für Fortgeschrittene",
            "Anwendungen der diskreten Mathematik in der Informatik",
        ]
        for title in non_math_titles:
            self.assertFalse(
                _is_math_compulsory_course(title, "INF", 999, set()),
                msg=f"did not expect math match for: {title}",
            )


if __name__ == "__main__":
    unittest.main()
