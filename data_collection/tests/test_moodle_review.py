from __future__ import annotations

import unittest

from data_collection.moodle.matching import AlmaCourseCandidate
from data_collection.moodle.review import apply_overrides, build_review_model, normalize_overrides


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


class MoodleReviewTests(unittest.TestCase):
    def test_build_review_model_scores_unresolved_candidates(self) -> None:
        model = build_review_model(
            {
                "courses": [
                    {
                        "moodle_course_id": "1558",
                        "title": "Mobile Robots (Robotics II)",
                        "course_url": "https://moodle.example/course/view.php?id=1558",
                        "summary_text": "",
                        "teachers": [{"display_name": "Andreas Zell"}],
                    }
                ],
                "matches": [
                    {
                        "moodle_course_id": "1558",
                        "moodle_title": "Mobile Robots (Robotics II)",
                        "status": "unmatched",
                        "evidence": {},
                    }
                ],
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
            candidate_limit=1,
        )

        self.assertEqual(len(model["unresolved"]), 1)
        self.assertEqual(model["unresolved"][0]["candidates"][0]["candidate"]["number"], "INF4361")

    def test_apply_overrides_accepts_manual_match(self) -> None:
        updated = apply_overrides(
            {
                "matches": [
                    {
                        "moodle_course_id": "1558",
                        "moodle_title": "Mobile Robots (Robotics II)",
                        "course_id": None,
                        "course_number": None,
                        "course_title": None,
                        "period_id": None,
                        "match_method": "title_lecturer",
                        "confidence": 0.0,
                        "status": "unmatched",
                        "evidence": {},
                    }
                ]
            },
            [
                {
                    "moodle_course_id": "1558",
                    "action": "accept",
                    "course_id": 21,
                    "course_number": "INF4361",
                    "course_title": "Vorlesung Mobile Roboter",
                    "period_id": "229",
                }
            ],
        )

        match = updated["matches"][0]
        self.assertEqual(match["status"], "accepted")
        self.assertEqual(match["course_number"], "INF4361")
        self.assertEqual(match["match_method"], "manual")
        self.assertTrue(match["evidence"]["manualOverride"])

    def test_normalize_overrides_filters_invalid_rows(self) -> None:
        self.assertEqual(
            normalize_overrides(
                [
                    {"moodle_course_id": "1558", "action": "accept", "course_id": "21"},
                    {"moodle_course_id": "", "action": "accept", "course_id": "22"},
                    {"moodle_course_id": "1580", "action": "other"},
                ]
            ),
            [
                {
                    "moodle_course_id": "1558",
                    "action": "accept",
                    "course_id": 21,
                    "course_number": None,
                    "course_title": None,
                    "period_id": None,
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
