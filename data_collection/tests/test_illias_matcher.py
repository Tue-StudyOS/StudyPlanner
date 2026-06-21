from __future__ import annotations

import unittest

from data_collection.illias.matcher import match_courses
from data_collection.illias.models import AlmaCourseCandidate, IliasCourse


class IliasMatcherTests(unittest.TestCase):
    def test_matches_unique_course_number(self) -> None:
        course = IliasCourse(ref_id="1", title="INFO2342 Fancy Course", url="https://example.test")
        alma = [
            AlmaCourseCandidate(
                course_id=42,
                number="INFO2342",
                title="Fancy Course",
                period_id="229",
                period_label="Sommer 2026",
            )
        ]

        matches = match_courses([course], alma)

        self.assertEqual(matches[0].alma_course_id, 42)
        self.assertEqual(matches[0].match_type, "exact_course_number")

    def test_ambiguous_course_number_is_not_guessed(self) -> None:
        course = IliasCourse(ref_id="1", title="INFO2342 Fancy Course", url="https://example.test")
        alma = [
            AlmaCourseCandidate(1, "INFO2342", "Fancy Course A", "229", "Sommer 2026"),
            AlmaCourseCandidate(2, "INFO2342", "Fancy Course B", "229", "Sommer 2026"),
        ]

        matches = match_courses([course], alma)

        self.assertIsNone(matches[0].alma_course_id)
        self.assertEqual(matches[0].match_type, "ambiguous_course_number")

    def test_lecturer_narrows_ambiguous_course_number(self) -> None:
        course = IliasCourse(
            ref_id="1",
            title="INFO2342 Fancy Course",
            url="https://example.test",
            instructors=["Prof. Dr. Ada Lovelace"],
        )
        alma = [
            AlmaCourseCandidate(1, "INFO2342", "Fancy Course A", "229", "Sommer 2026", ["Grace Hopper"]),
            AlmaCourseCandidate(2, "INFO2342", "Fancy Course B", "229", "Sommer 2026", ["Ada Lovelace"]),
        ]

        matches = match_courses([course], alma)

        self.assertEqual(matches[0].alma_course_id, 2)
        self.assertEqual(matches[0].match_type, "course_number_and_lecturer")

    def test_common_title_alone_does_not_match(self) -> None:
        course = IliasCourse(ref_id="1", title="Math", url="https://example.test")
        alma = [
            AlmaCourseCandidate(1, "MAT1001", "Mathematik für Informatik", "229", "Sommer 2026"),
            AlmaCourseCandidate(2, "MAT2001", "Mathematik für Physik", "229", "Sommer 2026"),
        ]

        matches = match_courses([course], alma)

        self.assertIsNone(matches[0].alma_course_id)
        self.assertEqual(matches[0].match_type, "unmatched")

    def test_parenthetical_lecturer_does_not_dilute_title_match(self) -> None:
        course = IliasCourse(
            ref_id="1",
            title="Database Systems (Torsten Grust)",
            url="https://example.test",
            instructors=["Torsten Grust"],
        )
        alma = [
            AlmaCourseCandidate(1, "INFO2420", "Database Systems", "229", "Sommer 2026", ["Grust, Torsten"]),
        ]

        matches = match_courses([course], alma)

        self.assertEqual(matches[0].alma_course_id, 1)
        self.assertIn(matches[0].match_type, {"title_similarity", "title_and_lecturer"})

    def test_slash_title_variant_matches_alma_title_without_code_prefix(self) -> None:
        course = IliasCourse(
            ref_id="1",
            title="Grundlagen des Maschinellen Lernens / Basics of Machine Learning",
            url="https://example.test",
        )
        alma = [
            AlmaCourseCandidate(
                1,
                "INF3151",
                "INF3151 Grundlagen des Maschinellen Lernens - Vorlesung/Übung",
                "229",
                "Sommer 2026",
            ),
        ]

        matches = match_courses([course], alma)

        self.assertEqual(matches[0].alma_course_id, 1)
        self.assertEqual(matches[0].match_type, "title_similarity")

    def test_single_distinctive_title_token_can_match_when_candidate_is_exactly_narrow(self) -> None:
        course = IliasCourse(ref_id="1", title="Programming in C++ - SS 2026", url="https://example.test")
        alma = [
            AlmaCourseCandidate(1, "INF3185", "INF3185 C++-Programming - Vorlesung", "229", "Sommer 2026"),
            AlmaCourseCandidate(
                2,
                "INFO4481",
                "INFO4481 Topics in Programming Language Theory - Seminar",
                "229",
                "Sommer 2026",
            ),
        ]

        matches = match_courses([course], alma)

        self.assertEqual(matches[0].alma_course_id, 1)
        self.assertEqual(matches[0].match_type, "title_similarity")


if __name__ == "__main__":
    unittest.main()
