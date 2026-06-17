import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from data_collection.moodle.matching import (  # noqa: E402
    AlmaCourseCandidate,
    extract_course_codes,
    match_one_moodle_course,
)


def candidate(
    course_id: int,
    number: str,
    title: str,
    course_type: str,
    lecturers: list[str] | None = None,
) -> AlmaCourseCandidate:
    return AlmaCourseCandidate(
        course_id=course_id,
        number=number,
        title=title,
        period_id="229",
        period_label="Sommer 2026",
        course_type=course_type,
        lecturers=lecturers or [],
        organisation="Fachbereich Informatik",
    )


class MoodleMatchingTest(unittest.TestCase):
    def test_normalizes_separator_codes_for_exact_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1471",
                "title": "INFO-4354 Public Cloud Computing (SoSe26)",
                "summary_text": "",
                "teachers": [{"display_name": "Michael Menth"}],
            },
            [
                candidate(
                    42,
                    "INFO4354",
                    "Public Cloud Computing",
                    "Vorlesung",
                    ["o. Prof. Dr. rer. nat. Michael Menth"],
                )
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 42)
        self.assertEqual(match.match_method, "exact_code")

    def test_title_match_with_type_conflict_needs_review(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1659",
                "title": "Seminar - Advances in Multimodal Learning SS26",
                "summary_text": "",
                "teachers": [{"display_name": "Hildegard Kuehne"}],
            },
            [
                candidate(
                    7,
                    "ML4512",
                    "Advances in Multimodal Learning",
                    "Praktikum",
                    ["Prof. Dr. -Ing. Hildegard Kuehne"],
                )
            ],
        )

        self.assertEqual(match.status, "needs_review")
        self.assertEqual(match.course_id, 7)
        self.assertLess(match.confidence, 0.82)

    def test_roman_tokens_help_disambiguate_fachdidaktik_courses(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1314",
                "title": "Fachdidaktik Informatik I, SoSe 2026",
                "summary_text": "",
                "teachers": [{"display_name": "Maria Knobelsdorf"}],
            },
            [
                candidate(1, "INFL01", "Fachdidaktik I", "Seminar", ["Maria Knobelsdorf"]),
                candidate(2, "INFL02", "Fachdidaktik II", "Vorlesung/Uebung", ["Maria Knobelsdorf"]),
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 1)

    def test_extracts_multiple_codes_from_alma_number_text(self) -> None:
        self.assertEqual(
            extract_course_codes("INF3241c (frueher INF1510)"),
            ["INF3241C", "INF1510"],
        )


if __name__ == "__main__":
    unittest.main()
