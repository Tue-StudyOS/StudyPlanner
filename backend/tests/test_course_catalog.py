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

from services.course_catalog import (  # noqa: E402
    _collect_offering_groups,
    _derive_term_type,
    _period_sort_key,
)


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


if __name__ == "__main__":
    unittest.main()
