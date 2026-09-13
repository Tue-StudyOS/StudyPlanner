import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path
from typing import Any

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.scripts.import_alma_json_to_d1 import (  # noqa: E402
    CURRICULUM_LINK_REBUILD_STATEMENTS,
    STUDY_AREA_CODE_ALIASES,
    build_seed_plan,
    compare_catalog_snapshots,
    derive_parallel_group_role,
    load_catalog_snapshot,
    load_existing_catalog_ids,
    write_seed_sql,
)

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


def _alma_course(period_id: str, unit_id: str, number: str, lecturer: str) -> dict[str, Any]:
    period_label = "Winter 2025/26" if period_id == "236" else "Winter 2026/27"
    return {
        "node_id": f"course-{unit_id}",
        "unit_id": unit_id,
        "period_id": period_id,
        "period_label": period_label,
        "title": f"{number} Example {unit_id} - Vorlesung",
        "details": {
            "fields": {"Nummer": number},
            "categories": ["INFO-INFO"],
            "content": {"sections": [{"title": "Inhalte", "text": "Text"}]},
            "parallel_groups": [
                {
                    "title": "Group (Übung)",
                    "fields": {"Verantwortliche/-r": lecturer},
                    "appointments": [{"Rhythmus": "Mo. wöchentlich", "Von - Bis": "10:00 - 12:00"}],
                }
            ],
        },
    }


class IncrementalImportTest(unittest.TestCase):
    """A full seed followed by an incremental import, run against the real
    migration schema, must leave the untouched period exactly as it was."""

    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        # D1 provides unixepoch(); plain sqlite3 builds may not.
        self.conn.create_function("unixepoch", -1, lambda *_: int(time.time()))
        for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
            self.conn.executescript(migration.read_text(encoding="utf-8"))
        self.temp_dir = tempfile.TemporaryDirectory()
        full_seed = {
            "courses": [
                _alma_course("236", "u1", "INFO4100", "Prof. A"),
                _alma_course("236", "u2", "INFO4200", "Prof. B"),
            ]
        }
        self._apply(build_seed_plan(full_seed), None)

    def tearDown(self) -> None:
        self.conn.close()
        self.temp_dir.cleanup()

    def _query(self, sql: str) -> list[dict[str, Any]]:
        return [dict(row) for row in self.conn.execute(sql).fetchall()]

    def _apply(self, plan: Any, replace_period_ids: list[str] | None) -> None:
        sql_path = Path(self.temp_dir.name) / "seed.sql"
        write_seed_sql(sql_path, plan, replace_period_ids)
        self.conn.executescript(sql_path.read_text(encoding="utf-8"))

    def _import_incrementally(self, courses: list[dict[str, Any]]) -> tuple[Any, list[str]]:
        before = load_catalog_snapshot(self._query)
        existing = load_existing_catalog_ids(self._query, ["237"])
        plan = build_seed_plan({"courses": courses}, existing)
        self._apply(plan, ["237"])
        after = load_catalog_snapshot(self._query)
        problems = compare_catalog_snapshots(
            before[0], after[0], before[1], after[1], {"237": len(plan.courses)}
        )
        return plan, problems

    def test_adding_a_period_keeps_the_other_period_unchanged(self) -> None:
        plan, problems = self._import_incrementally([
            _alma_course("237", "u1", "INFO4100", "Prof. A"),
            _alma_course("237", "u9", "INFO4900", "Prof. New"),
        ])

        self.assertEqual(problems, [])
        self.assertEqual([course["id"] for course in plan.courses], [3, 4])
        self.assertEqual([group["id"] for group in plan.parallel_groups], [3, 4])
        # Prof. A already exists and is reused; only the new lecturer is inserted.
        self.assertEqual([lecturer["display_name"] for lecturer in plan.lecturers], ["Prof. New"])
        self.assertEqual(plan.lecturers[0]["id"], 3)
        self.assertEqual(
            self._query("SELECT period_id, COUNT(*) AS n FROM courses GROUP BY period_id ORDER BY period_id"),
            [{"period_id": "236", "n": 2}, {"period_id": "237", "n": 2}],
        )

    def test_reimporting_a_period_keeps_course_ids_and_replaces_its_rows(self) -> None:
        self._import_incrementally([
            _alma_course("237", "u1", "INFO4100", "Prof. A"),
            _alma_course("237", "u9", "INFO4900", "Prof. New"),
        ])

        plan, problems = self._import_incrementally([_alma_course("237", "u9", "INFO4900", "Prof. New")])

        self.assertEqual(problems, [])
        self.assertEqual([course["id"] for course in plan.courses], [4])
        self.assertEqual(
            self._query("SELECT COUNT(*) AS n FROM parallel_groups WHERE course_id = 3"), [{"n": 0}]
        )
        self.assertEqual(self._query("SELECT COUNT(*) AS n FROM courses WHERE period_id = '237'"), [{"n": 1}])

    def test_regression_check_reports_a_changed_untouched_period(self) -> None:
        before = load_catalog_snapshot(self._query)
        self.conn.execute("UPDATE courses SET title = title || ' changed' WHERE id = 1")
        after = load_catalog_snapshot(self._query)

        problems = compare_catalog_snapshots(before[0], after[0], before[1], after[1], {})

        self.assertEqual(len(problems), 1)
        self.assertIn("period 236 changed", problems[0])

    def test_regression_check_reports_a_wrong_imported_course_count(self) -> None:
        snapshot, global_counts = load_catalog_snapshot(self._query)

        problems = compare_catalog_snapshots(snapshot, snapshot, global_counts, global_counts, {"237": 5})

        self.assertEqual(problems, ["period 237 has 0 courses, expected 5"])


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

            INSERT INTO study_programs (id, code, name) VALUES
                (1, 'BSC_INFO_2021', 'B.Sc. Informatik'),
                (2, 'MSC_ML_2021', 'M.Sc. Machine Learning');
            INSERT INTO study_areas (id, program_id, code) VALUES
                (10, 1, 'MATH'), (11, 1, 'PRAK'),
                (20, 2, 'ML-FOUND'), (21, 2, 'ML-DIVERSE'),
                (22, 2, 'ML-CS'), (23, 2, 'ML-EXP');
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

    def test_machine_learning_mach_codes_link_to_the_confirmed_ml_areas(self) -> None:
        self._add_course(500, ["MACH-FML", "MACH-DTML", "MACH-GCS", "MACH-EP"])

        self._rebuild_links()

        self.assertEqual(
            self._links(500),
            {
                (20, "MACH-FML"),
                (21, "MACH-DTML"),
                (22, "MACH-GCS"),
                (23, "MACH-EP"),
            },
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
