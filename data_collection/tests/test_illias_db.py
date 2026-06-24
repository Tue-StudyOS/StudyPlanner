from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from data_collection.illias.db import connect, import_scrape, load_illias_courses, save_matches
from data_collection.illias.models import CourseMatch


def _payload(title: str, ref_id: str) -> dict[str, object]:
    return {
        "source": {"start_url": "https://example.test", "fetched_at_unix": 1},
        "courses": [
            {
                "ref_id": ref_id,
                "title": title,
                "url": f"https://example.test/{ref_id}",
            }
        ],
    }


class IliasDatabaseTests(unittest.TestCase):
    def test_load_illias_courses_returns_only_latest_scrape_run(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "illias.sqlite"
            connection = connect(database_path)
            try:
                import_scrape(connection, _payload("Old course", "1"))
                import_scrape(connection, _payload("Current course", "2"))

                courses = load_illias_courses(connection)
            finally:
                connection.close()

        self.assertEqual([course.ref_id for course in courses], ["2"])

    def test_save_matches_replaces_stale_matches(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "illias.sqlite"
            connection = connect(database_path)
            try:
                import_scrape(connection, _payload("Current course", "2"))
                save_matches(connection, [CourseMatch("2", 10, 1.0, "exact_course_number", "Matched.", 1)])
                save_matches(connection, [CourseMatch("2", None, 0.0, "unmatched", "No match.", 0)])
                rows = connection.execute(
                    """
                    SELECT ic.ref_id AS illias_course_ref_id, m.alma_course_id, m.match_type
                    FROM illias_alma_matches AS m
                    JOIN illias_courses AS ic ON ic.id = m.illias_course_id
                    """
                ).fetchall()
            finally:
                connection.close()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["illias_course_ref_id"], "2")
        self.assertIsNone(rows[0]["alma_course_id"])
        self.assertEqual(rows[0]["match_type"], "unmatched")

    def test_illias_relationships_use_numeric_course_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            database_path = Path(temporary_directory) / "illias.sqlite"
            connection = connect(database_path)
            try:
                import_scrape(
                    connection,
                    {
                        "source": {"start_url": "https://example.test", "fetched_at_unix": 1},
                        "courses": [
                            {
                                "ref_id": "abc_42",
                                "title": "Current course",
                                "url": "https://example.test/abc_42",
                                "fields": {"Availability": "Online"},
                            }
                        ],
                    },
                )
                save_matches(connection, [CourseMatch("abc_42", None, 0.0, "unmatched", "No match.", 0)])
                row = connection.execute(
                    """
                    SELECT c.id, c.ref_id, f.course_id, m.illias_course_id
                    FROM illias_courses AS c
                    JOIN illias_course_fields AS f ON f.course_id = c.id
                    JOIN illias_alma_matches AS m ON m.illias_course_id = c.id
                    """
                ).fetchone()
            finally:
                connection.close()

        self.assertIsNotNone(row)
        self.assertIsInstance(row["id"], int)
        self.assertEqual(row["ref_id"], "abc_42")
        self.assertEqual(row["course_id"], row["id"])
        self.assertEqual(row["illias_course_id"], row["id"])


if __name__ == "__main__":
    unittest.main()
