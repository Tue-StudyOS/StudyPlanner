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
    period_id: str = "229",
    period_label: str = "Sommer 2026",
) -> AlmaCourseCandidate:
    return AlmaCourseCandidate(
        course_id=course_id,
        number=number,
        title=title,
        period_id=period_id,
        period_label=period_label,
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

    def test_title_match_with_type_conflict_is_not_auto_published(self) -> None:
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

        self.assertEqual(match.status, "unmatched")
        self.assertIsNone(match.course_id)

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

    def test_title_and_lecturer_are_enough_for_automated_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1531",
                "title": "Network Softwarization SoSe26",
                "summary_text": "",
                "teachers": [{"display_name": "Michael Menth"}],
            },
            [
                candidate(
                    20,
                    "INF4347",
                    "Network Softwarization",
                    "Vorlesung/Uebung",
                    ["o. Prof. Dr. rer. nat. Michael Menth"],
                )
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 20)

    def test_robot_synonym_allows_mobile_robots_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1558",
                "title": "Mobile Robots (Robotics II)",
                "summary_text": "",
                "teachers": [{"display_name": "Andreas Zell"}],
            },
            [
                candidate(
                    21,
                    "INF4361",
                    "Vorlesung Mobile Roboter",
                    "Vorlesung/Uebung",
                    ["o. Prof. Dr. rer. nat. Andreas Zell"],
                )
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 21)

    def test_extracts_multiple_codes_from_alma_number_text(self) -> None:
        self.assertEqual(
            extract_course_codes("INF3241c (frueher INF1510)"),
            ["INF3241C", "INF1510"],
        )

    def test_period_hint_prevents_old_exact_code_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1605",
                "title": "Mobile Robots Practical Course (INF4362) - SS26",
                "summary_text": "",
                "teachers": [{"display_name": "Andreas Zell"}],
            },
            [
                candidate(
                    76,
                    "INF4362",
                    "INF4362 Praktikum Mobile Roboter",
                    "Praktikum",
                    ["o. Prof. Dr. rer. nat. Andreas Zell"],
                    period_id="236",
                    period_label="Winter 2025/26",
                )
            ],
        )

        self.assertEqual(match.status, "unmatched")
        self.assertIsNone(match.course_id)

    def test_period_hint_prefers_summer_exact_code_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1605",
                "title": "Mobile Robots Practical Course (INF4362) - SS26",
                "summary_text": "",
                "teachers": [{"display_name": "Andreas Zell"}],
            },
            [
                candidate(
                    76,
                    "INF4362",
                    "INF4362 Praktikum Mobile Roboter",
                    "Praktikum",
                    ["o. Prof. Dr. rer. nat. Andreas Zell"],
                    period_id="236",
                    period_label="Winter 2025/26",
                ),
                candidate(
                    176,
                    "INF4362",
                    "INF4362 Praktikum Mobile Roboter",
                    "Praktikum",
                    ["o. Prof. Dr. rer. nat. Andreas Zell"],
                ),
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 176)

    def test_multimodal_praktikum_accepts_same_period_title_type_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1658",
                "title": "Praktikum - Advances in Multimodal Learning SS26",
                "summary_text": "ML4103",
                "teachers": [{"display_name": "Hildegard Kuehne"}],
            },
            [
                candidate(
                    200,
                    "ML4512",
                    "ML4512 Advances in Multimodal Learning - Praktikum - Praktikum",
                    "Praktikum",
                    ["Prof. Dr.-Ing. Hildegard Kuehne"],
                )
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 200)

    def test_multimodal_seminar_accepts_same_period_title_type_match(self) -> None:
        match = match_one_moodle_course(
            {
                "moodle_course_id": "1659",
                "title": "Seminar - Advances in Multimodal Learning SS26",
                "summary_text": "",
                "teachers": [{"display_name": "Hildegard Kuehne"}],
            },
            [
                candidate(
                    237,
                    "ML4503",
                    "ML4503 Advances in Multimodal Learning - Seminar",
                    "Seminar",
                    ["Prof. Dr.-Ing. Hildegard Kuehne"],
                )
            ],
        )

        self.assertEqual(match.status, "accepted")
        self.assertEqual(match.course_id, 237)


if __name__ == "__main__":
    unittest.main()
