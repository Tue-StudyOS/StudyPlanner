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

from services.course_catalog import (  # noqa: E402
    _collect_offering_groups,
    _derive_term_type,
    _extract_contents,
    _json_list,
    _load_illias_metadata,
    _period_sort_key,
)
from db.d1 import D1ExecutionError  # noqa: E402


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
