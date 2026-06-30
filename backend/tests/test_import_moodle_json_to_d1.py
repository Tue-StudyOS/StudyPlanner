import sys
import tempfile
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from backend.scripts.import_moodle_json_to_d1 import (  # noqa: E402
    build_seed_rows,
    course_id_exists_condition,
    course_id_expression,
    write_seed_sql,
)


class ImportMoodleJsonToD1Test(unittest.TestCase):
    def test_course_id_expression_uses_stable_period_and_number(self) -> None:
        expression = course_id_expression({"period_id": "229", "course_number": "INF4361"})

        self.assertEqual(
            expression,
            "(SELECT id FROM courses WHERE period_id = '229' AND number = 'INF4361' ORDER BY id LIMIT 1)",
        )

    def test_course_id_expression_ignores_stale_numeric_id(self) -> None:
        expression = course_id_expression({"course_id": 961})

        self.assertEqual(expression, "NULL")

    def test_course_id_exists_condition_uses_stable_period_and_number(self) -> None:
        condition = course_id_exists_condition({"period_id": "229", "course_number": "INF4361"})

        self.assertEqual(
            condition,
            "EXISTS (SELECT 1 FROM courses WHERE period_id = '229' AND number = 'INF4361')",
        )

    def test_learning_links_publish_from_stable_match_keys(self) -> None:
        rows = build_seed_rows(
            {
                "source": {"fetched_at_unix": 1781726834, "category_id": "235"},
                "courses": [
                    {
                        "moodle_course_id": "1558",
                        "title": "Mobile Robots (Robotics II)",
                        "normalized_title": "mobile robots robotics ii",
                        "course_url": "https://moodle.zdv.uni-tuebingen.de/course/view.php?id=1558",
                    }
                ],
                "matches": [
                    {
                        "moodle_course_id": "1558",
                        "course_id": None,
                        "course_number": "INF4361",
                        "period_id": "229",
                        "match_method": "manual",
                        "confidence": 1.0,
                        "status": "accepted",
                    }
                ],
            },
            run_id=1,
        )

        self.assertEqual(len(rows["learning_links"]), 1)
        self.assertEqual(rows["learning_links"][0]["course_number"], "INF4361")

    def test_learning_link_sql_skips_missing_local_course_rows(self) -> None:
        rows = build_seed_rows(
            {
                "source": {"fetched_at_unix": 1781726834, "category_id": "235"},
                "courses": [
                    {
                        "moodle_course_id": "1558",
                        "title": "Mobile Robots (Robotics II)",
                        "normalized_title": "mobile robots robotics ii",
                        "course_url": "https://moodle.zdv.uni-tuebingen.de/course/view.php?id=1558",
                    }
                ],
                "matches": [
                    {
                        "moodle_course_id": "1558",
                        "course_id": 961,
                        "course_number": "INF4361",
                        "period_id": "229",
                        "match_method": "title_lecturer",
                        "confidence": 0.74,
                        "status": "accepted",
                    }
                ],
            },
            run_id=1,
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "seed.sql"
            write_seed_sql(out_path, rows)
            sql = out_path.read_text(encoding="utf-8")

        self.assertIn('INSERT INTO "course_learning_links"', sql)
        self.assertIn("SELECT (SELECT id FROM courses", sql)
        self.assertIn(
            "WHERE EXISTS (SELECT 1 FROM courses WHERE period_id = '229' AND number = 'INF4361');",
            sql,
        )


if __name__ == "__main__":
    unittest.main()
