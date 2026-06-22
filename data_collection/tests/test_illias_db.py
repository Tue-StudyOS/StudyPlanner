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
                    SELECT illias_course_ref_id, alma_course_id, match_type
                    FROM illias_alma_matches
                    """
                ).fetchall()
            finally:
                connection.close()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["illias_course_ref_id"], "2")
        self.assertIsNone(rows[0]["alma_course_id"])
        self.assertEqual(rows[0]["match_type"], "unmatched")


if __name__ == "__main__":
    unittest.main()
