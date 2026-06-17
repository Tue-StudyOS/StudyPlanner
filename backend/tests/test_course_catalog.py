import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

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
    _collect_offering_groups,
    _derive_term_type,
    _extract_contents,
    _load_external_links,
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


if __name__ == "__main__":
    unittest.main()
