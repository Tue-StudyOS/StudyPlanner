from __future__ import annotations

import sqlite3
import unittest
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / 'migrations'


class ClientErrorLogMigrationTest(unittest.TestCase):
    def test_rebuilt_log_does_not_reference_removed_users_table(self) -> None:
        connection = sqlite3.connect(':memory:')
        connection.execute('CREATE TABLE users (id INTEGER PRIMARY KEY)')
        connection.executescript((MIGRATIONS_DIR / '0029_client_error_log.sql').read_text(encoding='utf-8'))
        connection.execute('PRAGMA foreign_keys = OFF')
        connection.execute('DROP TABLE users')
        connection.executescript((MIGRATIONS_DIR / '0032_secure_public_requests.sql').read_text(encoding='utf-8'))

        connection.executescript((MIGRATIONS_DIR / '0033_rebuild_client_error_log.sql').read_text(encoding='utf-8'))
        connection.execute(
            """
            INSERT INTO client_error_log (method, url, status, message, user_username)
            VALUES ('GET', '/api/test', 500, 'test error', NULL)
            """
        )

        foreign_keys = connection.execute('PRAGMA foreign_key_list(client_error_log)').fetchall()
        stored_count = connection.execute('SELECT COUNT(*) FROM client_error_log').fetchone()[0]
        self.assertEqual(foreign_keys, [])
        self.assertEqual(stored_count, 1)


if __name__ == '__main__':
    unittest.main()
