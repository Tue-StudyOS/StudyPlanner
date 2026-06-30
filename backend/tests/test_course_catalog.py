import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / "src"))

workers = types.ModuleType("workers")


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault("workers", workers)

from db.d1 import D1ExecutionError  # noqa: E402
from services import course_catalog  # noqa: E402
from services.course_catalog import (  # noqa: E402
    _build_participant_limits,
    _build_schedule,
    _collect_offering_groups,
    _derive_term_type,
    _extract_contents,
    _extract_contents_links,
    _json_list,
    _load_external_links,
    _load_illias_metadata,
    _pick_description,
    _pick_description_entry,
    _period_sort_key,
)


class ExtractContentsTest(unittest.TestCase):
    def test_strips_navigation_chrome_and_returns_real_text(self) -> None:
        sections = [
            {
                "title": "Inhalte",
                "text": (
                    "Semesterplanung Termine Inhalte Aktive Registerkarte "
                    "Vorlesungsverzeichnis Gekoppelte Prüfungen Module / Studiengänge "
                    "Inhalte Inhalte Inhalte This lecture covers medical data science."
                ),
            }
        ]
        self.assertEqual(
            _extract_contents(sections),
            "This lecture covers medical data science.",
        )

    def test_ignores_empty_placeholder_section(self) -> None:
        sections = [{"title": "Inhalte", "text": "Es wurden noch keine Inhalte hinterlegt."}]
        self.assertEqual(_extract_contents(sections), "")

    def test_returns_empty_when_no_inhalte_section(self) -> None:
        sections = [{"title": "Lernziele", "text": "Lernziele ..."}]
        self.assertEqual(_extract_contents(sections), "")

    def test_returns_links_for_cleaned_inhalte_section(self) -> None:
        sections = [
            {
                "title": "Inhalte",
                "text": "Inhalte Inhalte Inhalte See Webseite",
                "links": [{"label": "Webseite", "url": "https://example.org/course"}],
            }
        ]
        self.assertEqual(
            _extract_contents_links(sections),
            [{"label": "Webseite", "url": "https://example.org/course"}],
        )


class PickDescriptionTest(unittest.TestCase):
    def test_uses_informative_short_comment_first(self) -> None:
        self.assertEqual(
            _pick_description(
                "Registration opens in April.",
                [{"title": "Empfehlung", "text": "Useful section text"}],
            ),
            "Registration opens in April.",
        )

    def test_skips_ects_only_short_comment_for_real_section_text(self) -> None:
        self.assertEqual(
            _pick_description(
                "9 CP",
                [
                    {
                        "title": "Empfehlung",
                        "text": "Empfehlung Willkommen zur Vorlesung Mathematik.",
                    }
                ],
            ),
            "Willkommen zur Vorlesung Mathematik.",
        )

    def test_falls_back_to_ects_only_short_comment_when_no_section_exists(self) -> None:
        self.assertEqual(_pick_description("9 CP", []), "9 CP")

    def test_keeps_links_from_selected_description_section(self) -> None:
        self.assertEqual(
            _pick_description_entry(
                "9 CP",
                [
                    {
                        "title": "Empfehlung",
                        "text": "Empfehlung Webseite",
                        "links": [{"label": "Webseite", "url": "https://example.org/course"}],
                    }
                ],
            ),
            {
                "text": "Webseite",
                "links": [{"label": "Webseite", "url": "https://example.org/course"}],
            },
        )


class BuildScheduleTest(unittest.TestCase):
    def test_keeps_multi_room_exam_appointments(self) -> None:
        rows = [
            {
                "dateText": "27.07.2026",
                "timeText": "08:00 - 11:00",
                "roomText": "Hall N02",
                "groupTitle": "Klausur Mathematik fuer Informatik 2",
                "courseType": "Vorlesung",
            },
            {
                "dateText": "27.07.2026",
                "timeText": "08:00 - 11:00",
                "roomText": "Hall N03",
                "groupTitle": "Klausur Mathematik fuer Informatik 2",
                "courseType": "Vorlesung",
            },
            {
                "dateText": "29.09.2026",
                "timeText": "09:00 - 12:00",
                "roomText": "Hall 25",
                "groupTitle": "Klausur Mathematik fuer Informatik 2",
                "note": "Nachklausur",
                "courseType": "Vorlesung",
            },
            {
                "dateText": "29.09.2026",
                "timeText": "09:00 - 12:00",
                "roomText": "Hall 24",
                "groupTitle": "Klausur Mathematik fuer Informatik 2",
                "note": "Nachklausur",
                "courseType": "Vorlesung",
            },
        ]

        self.assertEqual(
            _build_schedule(rows),
            [
                {
                    "day": "27.07.2026",
                    "time": "08:00 - 11:00",
                    "room": "Hall N02",
                    "type": "Klausur",
                },
                {
                    "day": "27.07.2026",
                    "time": "08:00 - 11:00",
                    "room": "Hall N03",
                    "type": "Klausur",
                },
                {
                    "day": "29.09.2026",
                    "time": "09:00 - 12:00",
                    "room": "Hall 25",
                    "type": "Nachklausur",
                },
                {
                    "day": "29.09.2026",
                    "time": "09:00 - 12:00",
                    "room": "Hall 24",
                    "type": "Nachklausur",
                },
            ],
        )

    def test_keeps_same_time_tutorial_appointments(self) -> None:
        rows = [
            {
                "weekday": "Tuesday",
                "timeText": "12:00 - 14:00",
                "roomText": "C 110",
                "groupTitle": "Tutorial A",
                "groupType": "Tutorial",
            },
            {
                "weekday": "Tuesday",
                "timeText": "12:00 - 14:00",
                "roomText": "C 110",
                "groupTitle": "Tutorial B",
                "groupType": "Tutorial",
            },
        ]

        self.assertEqual(len(_build_schedule(rows)), 2)

    def test_keeps_weekly_date_range_slots(self) -> None:
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "10:00 - 12:00",
                "roomText": "Hall N06",
                "groupTitle": "Mathematik fuer Informatik 2",
                "courseType": "Vorlesung",
            },
        ]

        self.assertEqual(_build_schedule(rows)[0]["day"], "13.04.2026 - 20.07.2026")
        self.assertEqual(_build_schedule(rows)[0]["type"], "Vorlesung")


class PeriodSortKeyTest(unittest.TestCase):
    def test_orders_summer_before_winter_within_a_year(self) -> None:
        labels = ["Winter 2025/26", "Sommer 2026", "Sommer 2025", "Winter 2024/25"]
        labels.sort(key=_period_sort_key)
        self.assertEqual(
            labels,
            ["Winter 2024/25", "Sommer 2025", "Winter 2025/26", "Sommer 2026"],
        )


class DeriveTermTypeTest(unittest.TestCase):
    def test_classifies_summer_winter_and_both(self) -> None:
        self.assertEqual(_derive_term_type(["Sommer 2026", "Sommer 2025"]), "summer")
        self.assertEqual(_derive_term_type(["Winter 2025/26"]), "winter")
        self.assertEqual(_derive_term_type(["Sommer 2026", "Winter 2025/26"]), "both")
        self.assertEqual(_derive_term_type([]), "unknown")
        self.assertEqual(_derive_term_type(["Blockkurs"]), "unknown")


class CollectOfferingGroupsTest(unittest.TestCase):
    def test_deduplicates_by_course_key_and_picks_newest_representative(self) -> None:
        rows = [
            {"id": 1, "courseKey": "INFM1010", "periodLabel": "Sommer 2025"},
            {"id": 2, "courseKey": "INFM2020", "periodLabel": "Winter 2025/26"},
            {"id": 3, "courseKey": "INFM1010", "periodLabel": "Sommer 2026"},
            {"id": 4, "courseKey": "INFM1010", "periodLabel": "Winter 2025/26"},
        ]

        groups = _collect_offering_groups(rows)

        self.assertEqual(len(groups), 2)
        first = groups[0]
        self.assertEqual(first["courseKey"], "INFM1010")
        self.assertEqual(first["representativeId"], 3)
        self.assertEqual(
            first["offeredPeriods"],
            ["Sommer 2026", "Winter 2025/26", "Sommer 2025"],
        )
        self.assertEqual(groups[1]["courseKey"], "INFM2020")
        self.assertEqual(groups[1]["representativeId"], 2)

    def test_preserves_incoming_order_and_skips_rows_without_id(self) -> None:
        rows = [
            {"id": 7, "courseKey": "B", "periodLabel": "Sommer 2026"},
            {"id": None, "courseKey": "A", "periodLabel": "Sommer 2026"},
            {"id": 9, "courseKey": "A", "periodLabel": "Sommer 2026"},
        ]

        groups = _collect_offering_groups(rows)

        self.assertEqual([group["courseKey"] for group in groups], ["B", "A"])
        self.assertEqual(groups[1]["representativeId"], 9)

    def test_falls_back_to_id_when_course_key_missing(self) -> None:
        rows = [
            {"id": 11, "courseKey": None, "periodLabel": "Sommer 2026"},
            {"id": 12, "courseKey": None, "periodLabel": "Sommer 2026"},
        ]

        groups = _collect_offering_groups(rows)

        self.assertEqual(len(groups), 2)

class ParticipantLimitsTest(unittest.TestCase):
    def test_builds_compact_limits_from_parallel_groups(self) -> None:
        limits = _build_participant_limits(
            [
                {
                    "id": 10,
                    "title": "Lab group",
                    "groupType": "Praktikum",
                    "minParticipants": 5,
                    "maxParticipants": 12,
                },
                {
                    "id": 11,
                    "title": "Lecture",
                    "groupType": "Vorlesung",
                    "minParticipants": None,
                    "maxParticipants": None,
                },
            ]
        )

        self.assertEqual(
            limits,
            [
                {
                    "parallelGroupId": "10",
                    "title": "Lab group",
                    "groupType": "Praktikum",
                    "minParticipants": 5,
                    "maxParticipants": 12,
                }
            ],
        )


class ExternalLinksTest(unittest.IsolatedAsyncioTestCase):
    async def test_prefers_course_scoped_links_and_keeps_legacy_fallback(self) -> None:
        async def fake_fetch_all(env: object, sql: str, params: list[object] | None = None) -> list[dict]:
            if "course_learning_links" in sql:
                return [
                    {
                        "platform": "moodle",
                        "url": "https://moodle.example/course/view.php?id=1",
                        "label": "Moodle",
                    }
                ]
            if "course_external_links" in sql:
                return [
                    {
                        "platform": "moodle",
                        "url": "https://moodle.example/course/view.php?id=1",
                        "label": "Duplicate",
                    },
                    {
                        "platform": "ilias",
                        "url": "https://ilias.example/course",
                        "label": "Ilias",
                    },
                ]
            raise AssertionError(sql)

        with patch.object(course_catalog, "fetch_all", side_effect=fake_fetch_all):
            links = await _load_external_links({}, 42, "INF42")

        self.assertEqual(
            links,
            [
                {
                    "platform": "moodle",
                    "url": "https://moodle.example/course/view.php?id=1",
                    "label": "Moodle",
                },
                {
                    "platform": "ilias",
                    "url": "https://ilias.example/course",
                    "label": "Ilias",
                },
            ],
        )

    async def test_legacy_links_still_work_when_new_table_is_missing(self) -> None:
        async def fake_fetch_all(env: object, sql: str, params: list[object] | None = None) -> list[dict]:
            if "course_learning_links" in sql:
                raise D1ExecutionError("missing table")
            return [
                {
                    "platform": "moodle",
                    "url": "https://moodle.example/course/view.php?id=2",
                    "label": "Legacy Moodle",
                }
            ]

        with patch.object(course_catalog, "fetch_all", side_effect=fake_fetch_all):
            links = await _load_external_links({}, 42, "INF42")

        self.assertEqual(links[0]["label"], "Legacy Moodle")


class IliasMetadataTest(unittest.TestCase):
    def test_json_list_ignores_non_list_payloads(self) -> None:
        self.assertEqual(_json_list('{"name": "not a list"}'), [])
        self.assertEqual(_json_list("not json"), [])
        self.assertEqual(_json_list('["Ada", "", null, "Grace"]'), ["Ada", "Grace"])


class LoadIliasMetadataTest(unittest.IsolatedAsyncioTestCase):
    async def test_returns_none_when_illias_tables_are_missing(self) -> None:
        fetch_one = AsyncMock(side_effect=D1ExecutionError("no such table: illias_courses"))

        with patch("services.course_catalog.fetch_one", fetch_one):
            self.assertIsNone(await _load_illias_metadata({}, 42))

    async def test_raises_unrelated_d1_errors(self) -> None:
        fetch_one = AsyncMock(side_effect=D1ExecutionError("D1 query failed: syntax error"))

        with patch("services.course_catalog.fetch_one", fetch_one):
            with self.assertRaises(D1ExecutionError):
                await _load_illias_metadata({}, 42)

    async def test_normalizes_matched_illias_row(self) -> None:
        fetch_one = AsyncMock(
            return_value={
                "refId": "123",
                "title": "ILIAS Course",
                "url": "https://example.test/ilias.php?ref_id=123",
                "description": "Visible before joining",
                "availability": "Online",
                "registration": "Request membership",
                "deadline": "30.06.2026",
                "maxParticipants": 24,
                "tagsJson": '["INFO2342"]',
                "instructorsJson": '["Ada Lovelace"]',
                "confidence": 0.95,
                "matchType": "course_number_and_lecturer",
                "notes": "Exact code narrowed by lecturer.",
            }
        )

        with patch("services.course_catalog.fetch_one", fetch_one):
            metadata = await _load_illias_metadata({}, 42)

        self.assertEqual(metadata["refId"], "123")
        self.assertEqual(metadata["maxParticipants"], 24)
        self.assertEqual(metadata["tags"], ["INFO2342"])
        self.assertEqual(metadata["instructors"], ["Ada Lovelace"])
        self.assertEqual(metadata["match"]["confidence"], 0.95)


if __name__ == "__main__":
    unittest.main()
