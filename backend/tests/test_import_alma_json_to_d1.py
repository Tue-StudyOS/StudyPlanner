import sqlite3
import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.scripts.import_alma_json_to_d1 import (  # noqa: E402
    CURRICULUM_LINK_REBUILD_STATEMENTS,
    STUDY_AREA_CODE_ALIASES,
    build_seed_plan,
    derive_parallel_group_role,
)


class ParallelGroupNormalizationTest(unittest.TestCase):
    def test_reads_current_alma_parallel_group_field_labels(self) -> None:
        plan = build_seed_plan(
            {
                "courses": [
                    {
                        "node_id": "course-1",
                        "period_id": "236",
                        "title": "Example course",
                        "details": {
                            "fields": {"Nummer": "INFO1234"},
                            "parallel_groups": [
                                {
                                    "title": "Example group",
                                    "fields": {
                                        "Typ": "Übung",
                                        "Lehrsprache": "deutsch",
                                        "Verantwortliche/-r": "Prof. Example",
                                        "Maximale Anzahl Teilnehmer/-innen": "30",
                                        "Minimum der Teilnehmer/-innen für das Stattfinden der Veranstaltung": "5",
                                    },
                                    "appointments": [],
                                }
                            ],
                        },
                    }
                ]
            }
        )

        group = plan.parallel_groups[0]
        self.assertEqual(group["group_type"], "Übung")
        self.assertEqual(group["language"], "deutsch")
        self.assertEqual(group["max_participants"], 30)
        self.assertEqual(group["min_participants"], 5)


def _study_area_link_statements() -> list[str]:
    """The subset of the rebuild that populates course_study_area_links.

    Running the real production statements (base match + generated aliases)
    keeps the test honest: it exercises the exact SQL the importer emits.
    """
    return [s for s in CURRICULUM_LINK_REBUILD_STATEMENTS if "course_study_area_links" in s]


class StudyAreaAliasLinkTest(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.executescript(
            """
            CREATE TABLE study_programs (id INTEGER PRIMARY KEY, code TEXT, name TEXT);
            CREATE TABLE study_areas (id INTEGER PRIMARY KEY, program_id INTEGER, code TEXT);
            CREATE TABLE course_fields (course_id INTEGER, "key" TEXT, value TEXT);
            CREATE TABLE course_study_area_links (
                course_id INTEGER, study_area_id INTEGER, source_code TEXT,
                PRIMARY KEY (course_id, study_area_id)
            );

            INSERT INTO study_programs (id, code, name) VALUES (1, 'BSC_INFO_2021', 'B.Sc. Informatik');
            INSERT INTO study_areas (id, program_id, code) VALUES
                (10, 1, 'MATH'), (11, 1, 'PRAK');
            """
        )
        self.conn.commit()

    def tearDown(self) -> None:
        self.conn.close()

    def _add_course(self, course_id: int, category_codes: list[str]) -> None:
        import json

        self.conn.execute(
            'INSERT INTO course_fields (course_id, "key", value) VALUES (?, ?, ?)',
            (course_id, "_categories_json", json.dumps(category_codes)),
        )
        self.conn.commit()

    def _rebuild_links(self) -> None:
        for statement in _study_area_link_statements():
            self.conn.executescript(statement)
        self.conn.commit()

    def _links(self, course_id: int) -> set[tuple[int, str]]:
        rows = self.conn.execute(
            "SELECT study_area_id, source_code FROM course_study_area_links WHERE course_id = ?",
            (course_id,),
        ).fetchall()
        return set(rows)

    def test_compulsory_math_course_links_to_math_area(self) -> None:
        # MAT-95-41 Mathematik fuer Informatik 4: its only mappable code is the
        # ModulMath4 tag (no Wahlpflicht code), so the base match cannot link it.
        self._add_course(100, ["079L20", "INFM2020", "ModulMath4", "WMinfoA", "WMinfoB"])

        self._rebuild_links()

        self.assertIn((10, "ModulMath4"), self._links(100))

    def test_all_four_modulmath_codes_alias_to_math(self) -> None:
        for offset, code in enumerate(["ModulMath1", "ModulMath2", "ModulMath3", "ModulMath4"]):
            self._add_course(200 + offset, [code])

        self._rebuild_links()

        for offset in range(4):
            self.assertEqual(self._links(200 + offset), {(10, f"ModulMath{offset + 1}")})

    def test_existing_wahlpflicht_alias_still_links(self) -> None:
        # Regression guard: adding the math aliases must not disturb INFM3110->PRAK.
        self._add_course(300, ["INFM3110"])

        self._rebuild_links()

        self.assertEqual(self._links(300), {(11, "INFM3110")})

    def test_unmapped_code_produces_no_link(self) -> None:
        self._add_course(400, ["ZZZ-not-a-study-area"])

        self._rebuild_links()

        self.assertEqual(self._links(400), set())

    def test_math_aliases_are_registered(self) -> None:
        math_aliases = {(src, dst) for src, prog, dst in STUDY_AREA_CODE_ALIASES if dst == "MATH"}

        self.assertEqual(
            math_aliases,
            {("ModulMath1", "MATH"), ("ModulMath2", "MATH"), ("ModulMath3", "MATH"), ("ModulMath4", "MATH")},
        )


class DeriveParallelGroupRoleTest(unittest.TestCase):
    def test_reads_role_from_title_parenthetical(self) -> None:
        self.assertEqual(
            derive_parallel_group_role("Analysis (Vorlesung) (1. Parallelgruppe)"),
            "Vorlesung",
        )
        self.assertEqual(
            derive_parallel_group_role("Analysis (Übung) (2. Parallelgruppe)"),
            "Übung",
        )
        self.assertEqual(
            derive_parallel_group_role("Mathematik 2 (Klausur)"),
            "Klausur",
        )

    def test_nachklausur_wins_over_klausur(self) -> None:
        # "Nachklausur" contains "klausur", so rule order must resolve to the resit.
        self.assertEqual(
            derive_parallel_group_role("OC1: Nachklausur (2. Parallelgruppe)"),
            "Nachklausur",
        )
        self.assertEqual(
            derive_parallel_group_role("OC1: Wiederholung Klausur Grundlagen"),
            "Nachklausur",
        )

    def test_returns_none_when_title_has_no_role_marker(self) -> None:
        # No marker means the importer keeps ALMA's Veranstaltungsart / course-type
        # fallback instead of guessing.
        self.assertIsNone(
            derive_parallel_group_role("Tumorimmunologie (2. Parallelgruppe)")
        )
        self.assertIsNone(
            derive_parallel_group_role("Meilensteine (Bebenhausen, Gasthof Hirsch)")
        )

    def test_returns_none_for_empty_title(self) -> None:
        self.assertIsNone(derive_parallel_group_role(None))
        self.assertIsNone(derive_parallel_group_role(""))


if __name__ == "__main__":
    unittest.main()
