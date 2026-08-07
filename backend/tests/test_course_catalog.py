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
    _build_content_sections,
    _build_participant_limits,
    _build_schedule,
    _collect_offering_groups,
    _derive_term_type,
    _extract_contents_links,
    _json_list,
    _load_catalog_related,
    _load_external_links,
    _load_illias_metadata,
    _pick_description,
    _pick_description_entry,
    _period_sort_key,
    _build_search_where,
)


class BuildContentSectionsTest(unittest.TestCase):
    def test_strips_navigation_chrome_from_unstructured_inhalte_blob(self) -> None:
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
            _build_content_sections(sections, description=""),
            [
                {
                    "title": "Inhalte",
                    "text": "This lecture covers medical data science.",
                    "links": [],
                }
            ],
        )

    def test_keeps_labelled_sections_and_strips_duplicated_heading(self) -> None:
        sections = [
            {"title": "Lernziele", "text": "Lernziele Understand statistics."},
            {"title": "Literatur", "text": "Literatur Kruschke, Doing Bayesian Data Analysis."},
        ]
        self.assertEqual(
            _build_content_sections(sections, description=""),
            [
                {"title": "Lernziele", "text": "Understand statistics.", "links": []},
                {
                    "title": "Literatur",
                    "text": "Kruschke, Doing Bayesian Data Analysis.",
                    "links": [],
                },
            ],
        )

    def test_drops_prerequisite_and_description_sections(self) -> None:
        sections = [
            {"title": "Voraussetzung", "text": "Voraussetzung Linear algebra."},
            {"title": "Empfehlung", "text": "Empfehlung Read chapter one."},
            {"title": "Lernziele", "text": "Lernziele Understand statistics."},
        ]
        # The Empfehlung text is what _pick_description chose, so it must not repeat.
        result = _build_content_sections(sections, description="Empfehlung Read chapter one.")
        self.assertEqual(
            result,
            [{"title": "Lernziele", "text": "Understand statistics.", "links": []}],
        )

    def test_ignores_empty_placeholder_section(self) -> None:
        sections = [{"title": "Inhalte", "text": "Es wurden noch keine Inhalte hinterlegt."}]
        self.assertEqual(_build_content_sections(sections, description=""), [])

    def test_returns_empty_when_no_content_sections(self) -> None:
        self.assertEqual(_build_content_sections([], description=""), [])

    def test_carries_embedded_links_on_each_block(self) -> None:
        sections = [
            {
                "title": "Inhalte",
                "text": "Inhalte Inhalte Inhalte See Webseite",
                "links": [{"label": "Webseite", "url": "https://example.org/course"}],
            }
        ]
        self.assertEqual(
            _build_content_sections(sections, description=""),
            [
                {
                    "title": "Inhalte",
                    "text": "See Webseite",
                    "links": [{"label": "Webseite", "url": "https://example.org/course"}],
                }
            ],
        )

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

        schedule = _build_schedule(rows)
        self.assertEqual(
            [
                {
                    "day": slot["day"],
                    "time": slot["time"],
                    "room": slot["room"],
                    "type": slot["type"],
                }
                for slot in schedule
            ],
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
        self.assertTrue(all(slot["calendarRelevant"] for slot in schedule))

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

    def test_reads_lecture_and_tutorial_role_from_appointment_note(self) -> None:
        # Probabilistic ML keeps every session in one untyped parallel group; the
        # role only exists in the per-appointment note.
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "10:00 - 12:00",
                "roomText": "Hall 25",
                "groupTitle": "Probabilistic Machine Learning",
                "note": "Vorlesung",
                "courseType": "Vorlesung/Übung",
            },
            {
                "dateText": "15.04.2026 - 22.07.2026",
                "timeText": "12:00 - 14:00",
                "roomText": "Hall 22",
                "groupTitle": "Probabilistic Machine Learning",
                "note": "Plenarübung",
                "courseType": "Vorlesung/Übung",
            },
        ]

        schedule = _build_schedule(rows)
        self.assertEqual(schedule[0]["type"], "Vorlesung")
        self.assertEqual(schedule[1]["type"], "Übung")

    def test_note_mentioning_both_roles_counts_as_tutorial(self) -> None:
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "14:00 - 16:00",
                "roomText": "C 110",
                "groupTitle": "Analysis",
                "note": "Übung zur Vorlesung",
                "courseType": "Vorlesung/Übung",
            },
        ]

        self.assertEqual(_build_schedule(rows)[0]["type"], "Übung")

    def test_empty_note_still_falls_back_to_group_then_course_type(self) -> None:
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "10:00 - 12:00",
                "roomText": "Hall 25",
                "groupTitle": "Some Course",
                "courseType": "Vorlesung/Übung",
            },
        ]

        self.assertEqual(_build_schedule(rows)[0]["type"], "Vorlesung/Übung")

    def test_reads_role_from_group_type_when_note_is_empty(self) -> None:
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "10:00 - 12:00",
                "roomText": "Hall 25",
                "groupTitle": "Mathematik für Informatik 4 (Vorlesung)",
                "groupType": "Vorlesung",
                "courseType": "Vorlesung/Übung",
            },
            {
                "dateText": "14.04.2026 - 21.07.2026",
                "timeText": "12:00 - 14:00",
                "roomText": "C 110",
                "groupTitle": "Tutorium A",
                "groupType": "Tutorium",
                "courseType": "Vorlesung/Übung",
            },
        ]

        schedule = _build_schedule(rows)
        self.assertEqual(schedule[0]["type"], "Vorlesung")
        self.assertEqual(schedule[1]["type"], "Übung")

    def test_reads_role_from_group_title_when_group_type_is_empty(self) -> None:
        rows = [
            {
                "dateText": "14.04.2026 - 21.07.2026",
                "timeText": "12:00 - 14:00",
                "roomText": "C 110",
                "groupTitle": "Tutorium A",
                "courseType": "Vorlesung/Übung",
            },
        ]

        self.assertEqual(_build_schedule(rows)[0]["type"], "Übung")

    def test_combined_group_type_stays_ambiguous_without_appointment_note(self) -> None:
        rows = [
            {
                "dateText": "13.04.2026 - 20.07.2026",
                "timeText": "10:00 - 12:00",
                "roomText": "Hall 25",
                "groupTitle": "Some Course",
                "groupType": "Vorlesung/Übung",
                "courseType": "Vorlesung/Übung",
            },
        ]

        self.assertEqual(_build_schedule(rows)[0]["type"], "Vorlesung/Übung")

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

    def test_marks_administrative_dates_as_not_calendar_relevant(self) -> None:
        schedule = _build_schedule(
            [
                {
                    "appointmentId": 99,
                    "courseId": 7,
                    "dateText": "18.02.2026",
                    "timeText": "08:00 - 18:00",
                    "note": "Klausurkorrektur",
                    "courseType": "Vorlesung",
                    "cancellationDatesJson": '["2026-01-12"]',
                },
            ]
        )

        self.assertEqual(schedule[0]["id"], "99")
        self.assertEqual(schedule[0]["sourceCourseId"], "7")
        self.assertEqual(schedule[0]["type"], "Klausurkorrektur")
        self.assertFalse(schedule[0]["calendarRelevant"])
        self.assertEqual(schedule[0]["cancellationDates"], ["2026-01-12"])


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

    def test_combines_lecture_and_exercise_variants_in_the_same_period(self) -> None:
        rows = [
            {
                "id": 1,
                "courseKey": "INFM1110",
                "title": "INFM1110 Praktische Informatik 1 (früher Informatik I) - Vorlesung",
                "courseType": "Vorlesung",
                "periodLabel": "Winter 2025/26",
            },
            {
                "id": 2,
                "courseKey": "INFM1110",
                "title": "INFM1110 Übungen zu Praktische Informatik 1 (früher Informatik I) - Übung",
                "courseType": "Übung",
                "periodLabel": "Winter 2025/26",
            },
        ]

        groups = _collect_offering_groups(rows)

        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["representativeId"], 1)
        self.assertEqual(groups[0]["representativeIds"], [1, 2])

    def test_does_not_merge_unrelated_courses_with_a_generic_number(self) -> None:
        rows = [
            {
                "id": 10,
                "courseKey": "INF",
                "title": "INF Mathematischer Vorbereitungskurs - Einführungskurs",
                "courseType": "Einführungskurs",
                "periodLabel": "Winter 2025/26",
            },
            {
                "id": 11,
                "courseKey": "INF",
                "title": "INF Girls Digital Camp - Praktikum",
                "courseType": "Praktikum",
                "periodLabel": "Winter 2025/26",
            },
        ]

        self.assertEqual(len(_collect_offering_groups(rows)), 2)


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


class CatalogBatchLoadingTest(unittest.IsolatedAsyncioTestCase):
    async def test_loads_large_course_id_sets_in_one_json_batch(self) -> None:
        course_ids = list(range(1, 251))
        load_rows = AsyncMock(return_value=([], [], [], []))

        with patch.object(course_catalog, "_load_catalog_related_rows", load_rows):
            result = await _load_catalog_related(object(), course_ids)

        load_rows.assert_awaited_once()
        self.assertEqual(load_rows.await_args.args[1], course_ids)
        self.assertEqual(result, ({}, {}, {}, {}))


class SearchWhereTest(unittest.TestCase):
    def test_includes_lecturer_names_in_search_clause(self) -> None:
        where_clause, params = _build_search_where(['müller'])

        self.assertIn('course_lecturers', where_clause)
        self.assertIn('display_name', where_clause)
        self.assertEqual(len(params), 5)
        self.assertTrue(all('%müller%' in param for param in params))


class AllPeriodCatalogSearchTest(unittest.IsolatedAsyncioTestCase):
    async def test_returns_immediately_when_search_has_no_matches(self) -> None:
        fetch_all = AsyncMock(return_value=[])
        with patch.object(course_catalog, "fetch_all", fetch_all):
            result = await course_catalog._list_all_catalog_courses({}, 1000, "missing")

        self.assertEqual(result, [])
        fetch_all.assert_awaited_once()

    async def test_loads_only_period_rows_for_matching_course_keys(self) -> None:
        fetch_all = AsyncMock(side_effect=[
            [{"id": 7, "courseKey": "INFO7"}],
            [],
        ])
        with patch.object(course_catalog, "fetch_all", fetch_all):
            result = await course_catalog._list_all_catalog_courses({}, 1000, "parallel")

        self.assertEqual(result, [])
        family_query = fetch_all.await_args_list[1]
        self.assertIn("IN (SELECT value FROM json_each(?))", family_query.args[1])
        self.assertEqual(family_query.args[2], ['["INFO7"]'])


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


class AttachReviewSummariesTest(unittest.IsolatedAsyncioTestCase):
    async def test_folds_the_average_into_matching_courses_only(self) -> None:
        summaries = [
            {"id": "1", "number": "INF-01"},
            {"id": "2", "number": "INF-02"},
        ]
        fetch_all = AsyncMock(
            return_value=[{"courseKey": "inf-01", "reviewCount": 3, "averageRating": 4.3333}]
        )

        with patch.object(course_catalog, "fetch_all", fetch_all):
            await course_catalog._attach_review_summaries(object(), summaries)

        self.assertEqual(summaries[0]["rating"], {"average": 4.33, "count": 3})
        self.assertNotIn("rating", summaries[1])

    async def test_matches_the_stored_key_regardless_of_course_number_casing(self) -> None:
        summaries = [{"id": "1", "number": "Inf-01"}]
        fetch_all = AsyncMock(
            return_value=[{"courseKey": "inf-01", "reviewCount": 1, "averageRating": 5}]
        )

        with patch.object(course_catalog, "fetch_all", fetch_all):
            await course_catalog._attach_review_summaries(object(), summaries)

        self.assertEqual(summaries[0]["rating"], {"average": 5.0, "count": 1})

    async def test_skips_the_query_when_no_course_has_a_number(self) -> None:
        summaries = [{"id": "1", "number": ""}]
        fetch_all = AsyncMock()

        with patch.object(course_catalog, "fetch_all", fetch_all):
            await course_catalog._attach_review_summaries(object(), summaries)

        fetch_all.assert_not_awaited()

    async def test_catalog_still_renders_when_the_reviews_table_is_missing(self) -> None:
        """The worker can ship before migration 0034 is applied."""
        summaries = [{"id": "1", "number": "INF-01"}]
        fetch_all = AsyncMock(side_effect=D1ExecutionError("no such table: course_reviews"))

        with patch.object(course_catalog, "fetch_all", fetch_all):
            await course_catalog._attach_review_summaries(object(), summaries)

        self.assertNotIn("rating", summaries[0])

    async def test_other_database_errors_still_surface(self) -> None:
        summaries = [{"id": "1", "number": "INF-01"}]
        fetch_all = AsyncMock(side_effect=D1ExecutionError("no such table: courses"))

        with (
            patch.object(course_catalog, "fetch_all", fetch_all),
            self.assertRaises(D1ExecutionError),
        ):
            await course_catalog._attach_review_summaries(object(), summaries)


if __name__ == "__main__":
    unittest.main()
