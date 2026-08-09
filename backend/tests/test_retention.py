import sqlite3
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import retention  # noqa: E402


class RetentionBoundaryTest(unittest.TestCase):
    NOW_UNIX = 1_786_233_600  # 2026-08-09T00:00:00Z

    def setUp(self) -> None:
        self.database = sqlite3.connect(':memory:')
        self.database.executescript(
            """
            CREATE TABLE client_error_log (id INTEGER PRIMARY KEY, created_at_unix INTEGER NOT NULL);
            CREATE TABLE user_feedback (id INTEGER PRIMARY KEY, created_at_unix INTEGER NOT NULL);
            CREATE TABLE request_rate_limits (
                scope TEXT NOT NULL,
                client_key TEXT NOT NULL,
                window_started_at_unix INTEGER NOT NULL
            );
            CREATE TABLE course_reviews (
                id INTEGER PRIMARY KEY,
                is_hidden INTEGER NOT NULL,
                retention_hold INTEGER NOT NULL,
                updated_at_unix INTEGER NOT NULL
            );
            CREATE TABLE review_notices (
                id INTEGER PRIMARY KEY,
                status TEXT NOT NULL,
                retention_hold INTEGER NOT NULL,
                decided_at_unix INTEGER
            );
            CREATE TABLE non_target_data (value TEXT NOT NULL);
            INSERT INTO non_target_data VALUES ('keep');
            """
        )

    def tearDown(self) -> None:
        self.database.close()

    def _calendar_cutoff(self) -> int:
        row = self.database.execute(
            "SELECT unixepoch(?, 'unixepoch', '-6 months')",
            [self.NOW_UNIX],
        ).fetchone()
        return int(row[0])

    def _apply_cleanup(self) -> None:
        with self.database:
            for sql, parameters in retention.build_retention_statements(self.NOW_UNIX):
                self.database.execute(sql, parameters)

    def test_boundaries_holds_and_non_target_data_are_preserved(self) -> None:
        diagnostic_cutoff = self.NOW_UNIX - retention.DIAGNOSTIC_RETENTION_SECONDS
        calendar_cutoff = self._calendar_cutoff()
        rate_cutoff = self.NOW_UNIX - retention.RATE_LIMIT_GRACE_SECONDS

        self.database.executemany(
            'INSERT INTO client_error_log VALUES (?, ?)',
            [(1, diagnostic_cutoff - 1), (2, diagnostic_cutoff), (3, diagnostic_cutoff + 1)],
        )
        self.database.executemany(
            'INSERT INTO user_feedback VALUES (?, ?)',
            [(1, calendar_cutoff - 1), (2, calendar_cutoff), (3, calendar_cutoff + 1)],
        )
        self.database.executemany(
            'INSERT INTO request_rate_limits VALUES (?, ?, ?)',
            [
                ('ai_catalog', 'old', rate_cutoff - 61),
                ('ai_catalog', 'boundary', rate_cutoff - 60),
                ('feedback', 'new', rate_cutoff - 3599),
                ('future_scope', 'unknown', 1),
            ],
        )
        self.database.executemany(
            'INSERT INTO course_reviews VALUES (?, ?, ?, ?)',
            [
                (1, 1, 0, calendar_cutoff - 1),
                (2, 1, 0, calendar_cutoff),
                (3, 0, 0, calendar_cutoff - 1),
                (4, 1, 1, calendar_cutoff - 1),
            ],
        )
        self.database.executemany(
            'INSERT INTO review_notices VALUES (?, ?, ?, ?)',
            [
                (1, 'resolved', 0, calendar_cutoff - 1),
                (2, 'resolved', 0, calendar_cutoff),
                (3, 'received', 0, calendar_cutoff - 1),
                (4, 'resolved', 1, calendar_cutoff - 1),
            ],
        )

        self._apply_cleanup()
        self._apply_cleanup()

        self.assertEqual(
            self.database.execute('SELECT id FROM client_error_log ORDER BY id').fetchall(),
            [(2,), (3,)],
        )
        self.assertEqual(
            self.database.execute('SELECT id FROM user_feedback ORDER BY id').fetchall(),
            [(2,), (3,)],
        )
        self.assertEqual(
            self.database.execute('SELECT client_key FROM request_rate_limits ORDER BY client_key').fetchall(),
            [('boundary',), ('new',), ('unknown',)],
        )
        self.assertEqual(
            self.database.execute('SELECT id FROM course_reviews ORDER BY id').fetchall(),
            [(2,), (3,), (4,)],
        )
        self.assertEqual(
            self.database.execute('SELECT id FROM review_notices ORDER BY id').fetchall(),
            [(2,), (3,), (4,)],
        )
        self.assertEqual(self.database.execute('SELECT value FROM non_target_data').fetchone(), ('keep',))

    def test_migrations_add_holds_notice_table_and_cleanup_indexes(self) -> None:
        database = sqlite3.connect(':memory:')
        try:
            database.executescript(
                """
                CREATE TABLE course_reviews (
                    id INTEGER PRIMARY KEY,
                    is_hidden INTEGER NOT NULL DEFAULT 0,
                    updated_at_unix INTEGER NOT NULL
                );
                CREATE TABLE request_rate_limits (
                    scope TEXT NOT NULL,
                    client_key TEXT NOT NULL,
                    window_started_at_unix INTEGER NOT NULL,
                    request_count INTEGER NOT NULL
                );
                """
            )
            migration_path = Path(__file__).resolve().parents[1] / 'migrations' / '0035_retention_controls.sql'
            database.executescript(migration_path.read_text(encoding='utf-8'))
            notice_migration_path = (
                Path(__file__).resolve().parents[1]
                / 'migrations'
                / '0036_review_notice_moderation.sql'
            )
            database.executescript(notice_migration_path.read_text(encoding='utf-8'))

            columns = {
                str(row[1])
                for row in database.execute('PRAGMA table_info(course_reviews)').fetchall()
            }
            indexes = {
                str(row[0])
                for row in database.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'index'"
                ).fetchall()
            }
            self.assertIn('retention_hold', columns)
            self.assertIn('idx_course_reviews_hidden_retention', indexes)
            self.assertIn('idx_request_rate_limits_window', indexes)
            self.assertIsNotNone(
                database.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'review_notices'"
                ).fetchone()
            )
            self.assertIn('idx_review_notices_retention', indexes)
        finally:
            database.close()


class RetentionExecutionTest(unittest.IsolatedAsyncioTestCase):
    async def test_scheduled_cleanup_returns_only_aggregate_counts(self) -> None:
        execute_batch = AsyncMock(
            return_value=[
                {'meta': {'changes': 2}},
                {'meta': {'changes': 3}},
                {'meta': {'changes': 4}},
                {'meta': {'changes': 5}},
                {'meta': {'changes': 6}},
            ]
        )

        with patch.object(retention, 'execute_batch', execute_batch):
            result = await retention.run_retention_cleanup({}, current_unix=123)

        self.assertEqual(
            result,
            {
                'clientDiagnosticsDeleted': 2,
                'feedbackDeleted': 3,
                'rateLimitsDeleted': 4,
                'hiddenReviewsDeleted': 5,
                'closedReviewNoticesDeleted': 6,
            },
        )
        self.assertEqual(len(execute_batch.await_args.args[1]), 5)


if __name__ == '__main__':
    unittest.main()
