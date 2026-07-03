import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.scripts.import_alma_json_to_d1 import (  # noqa: E402
    derive_parallel_group_role,
)


class DeriveParallelGroupRoleTest(unittest.TestCase):
    def test_reads_role_from_title_parenthetical(self) -> None:
        self.assertEqual(
            derive_parallel_group_role("Stochastik (Vorlesung) (1. Parallelgruppe)", "Vorlesung"),
            "Vorlesung",
        )
        self.assertEqual(
            derive_parallel_group_role("Stochastik (Übung) (2. Parallelgruppe)", "Vorlesung"),
            "Übung",
        )
        self.assertEqual(
            derive_parallel_group_role("Stochastik (Klausur) (3. Parallelgruppe)", "Vorlesung"),
            "Klausur",
        )

    def test_nachklausur_wins_over_klausur(self) -> None:
        self.assertEqual(
            derive_parallel_group_role("OC1: Nachklausur (2. Parallelgruppe)", "Vorlesung"),
            "Nachklausur",
        )
        self.assertEqual(
            derive_parallel_group_role(
                "OC1: Wiederholung Klausur Grundlagen (4. Parallelgruppe)", "Vorlesung"
            ),
            "Nachklausur",
        )

    def test_falls_back_to_course_type_when_no_marker(self) -> None:
        # The common case: a single-format course whose group title carries only
        # a topic and the "N. Parallelgruppe" counter.
        self.assertEqual(
            derive_parallel_group_role(
                "Tumorimmunologie (2. Parallelgruppe)", "Vorlesung/Übung"
            ),
            "Vorlesung/Übung",
        )
        self.assertEqual(
            derive_parallel_group_role("Meilensteine der Immunologie", "Seminar"),
            "Seminar",
        )

    def test_ignores_location_and_counter_parentheticals(self) -> None:
        # A title made only of a topic, a location and the "N. Parallelgruppe"
        # counter carries no role word, so we fall back to the course type.
        self.assertEqual(
            derive_parallel_group_role(
                "Meilensteine (Bebenhausen, Gasthof Hirsch) (1. Parallelgruppe)", "Seminar"
            ),
            "Seminar",
        )
        self.assertEqual(
            derive_parallel_group_role("Statistik (Teil 1)", "Vorlesung"),
            "Vorlesung",
        )

    def test_returns_none_when_no_title_and_no_course_type(self) -> None:
        self.assertIsNone(derive_parallel_group_role(None, None))
        self.assertIsNone(derive_parallel_group_role("", ""))


if __name__ == "__main__":
    unittest.main()
