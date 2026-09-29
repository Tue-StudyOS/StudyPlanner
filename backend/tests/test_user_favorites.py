import json
import sqlite3
import sys
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))
workers = types.ModuleType('workers')


class Response:
    def __init__(self, *args: object, **kwargs: object) -> None:
        self.args = args
        self.kwargs = kwargs


workers.Response = Response
sys.modules.setdefault('workers', workers)
from services import user_favorites  # noqa: E402


class UserFavoritesTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.database = sqlite3.connect(':memory:')
        self.database.row_factory = sqlite3.Row
        self.database.executescript('''
            CREATE TABLE courses (id INTEGER PRIMARY KEY, number TEXT, unit_id TEXT);
            INSERT INTO courses VALUES (42, 'CS-42', NULL), (99, 'CS-99', NULL), (142, 'CS-42', NULL);
            CREATE TABLE user_state (
                username TEXT PRIMARY KEY, favorites_json TEXT,
                semester_plans_json TEXT DEFAULT '{}', updated_at_unix INTEGER
            );
            INSERT INTO user_state(username, favorites_json) VALUES ('alice', '{}');
        ''')
        patches = [
            patch.object(user_favorites, 'require_authenticated_user', AsyncMock(return_value={'username': 'alice'})),
            patch.object(user_favorites, 'get_simulated_semester_label', AsyncMock(return_value='SS 2026')),
            patch.object(user_favorites, 'load_user_state_json', self.load_state),
            patch.object(user_favorites, 'fetch_all', self.fetch_all),
            patch.object(user_favorites, 'execute', self.execute),
        ]
        for mock_patch in patches:
            mock_patch.start()
            self.addCleanup(mock_patch.stop)
        self.addCleanup(self.database.close)

    async def load_state(self, env: Any, username: str, column: str) -> str:
        return self.database.execute(f'SELECT {column} FROM user_state WHERE username = ?', [username]).fetchone()[0]

    async def fetch_all(self, env: Any, sql: str, params: list[Any]) -> list[dict[str, Any]]:
        return [dict(row) for row in self.database.execute(sql, params)]

    async def execute(self, env: Any, sql: str, params: list[Any]) -> None:
        self.database.execute(sql, params)

    def store(self, favorites: Any, plans: dict[str, Any] | None = None) -> None:
        self.database.execute(
            'UPDATE user_state SET favorites_json = ?, semester_plans_json = ?',
            [json.dumps(favorites), json.dumps(plans or {})],
        )

    def favorites(self) -> dict[str, Any]:
        return json.loads(self.database.execute('SELECT favorites_json FROM user_state').fetchone()[0])

    async def read(self, semester: str) -> dict[str, Any]:
        return await user_favorites.get_current_user_favorites(object(), object(), semester)

    async def write(self, semester: str, ids: list[Any]) -> dict[str, Any]:
        return await user_favorites.replace_current_user_favorites(
            object(), object(), {'semesterLabel': semester, 'favoriteCourseIds': ids},
        )

    async def test_new_semester_is_empty_and_old_stars_remain(self) -> None:
        self.store({'SS 2026': ['cs-42']})
        new = await self.read('WS 2026/27')
        self.assertEqual(new['favoriteCourseIds'], [])
        self.assertEqual((await self.read('SS 2026'))['favoriteCourseIds'], ['42', '142'])
        self.assertEqual(self.favorites(), {'SS 2026': ['cs-42']})

    async def test_writes_are_scoped_and_store_stable_keys(self) -> None:
        self.store({'SS 2026': ['cs-99'], 'WS 2026/27': ['cs-99']})
        result = await self.write('WS 2026/27', ['42', '142', '1107'])
        self.assertEqual(self.favorites(), {'SS 2026': ['cs-99'], 'WS 2026/27': ['cs-42']})
        self.assertEqual(result['favoriteCourseIds'], ['42', '142'])
        self.assertEqual(result['favoriteCourseGroups'], [['42', '142']])
        self.assertEqual(result['count'], 1)
        await self.write('WS 2026/27', [])
        self.assertEqual(self.favorites()['SS 2026'], ['cs-99'])
        self.assertEqual(self.favorites()['WS 2026/27'], [])

    async def test_stars_survive_reseed_without_repointing(self) -> None:
        await self.write('SS 2026', ['42'])
        self.database.execute('DELETE FROM courses')
        self.database.executescript("INSERT INTO courses VALUES (42, 'unrelated', NULL), (777, 'CS-42', NULL);")
        self.assertEqual((await self.read('SS 2026'))['favoriteCourseIds'], ['777'])

    async def test_missing_catalog_keys_are_not_pruned_by_read(self) -> None:
        self.store({'SS 2026': ['cs-42', 'temporarily-missing']})
        await self.read('SS 2026')
        self.assertEqual(self.favorites()['SS 2026'], ['cs-42', 'temporarily-missing'])

    async def test_unit_id_is_used_when_number_is_missing(self) -> None:
        self.database.execute("INSERT INTO courses VALUES (200, NULL, 'UNIT-200')")
        await self.write('SS 2026', ['200'])
        self.assertEqual(self.favorites()['SS 2026'], ['unit-200'])
        self.assertEqual((await self.read('SS 2026'))['favoriteCourseIds'], ['200'])

    async def test_legacy_lists_use_plan_membership_and_keep_unassigned_in_running_term(self) -> None:
        plans = {'WS 2025/26': {'courseIds': ['42'], 'notes': 'Keep my history'}}
        self.store(['42', '99', '1107', 'not-a-number'], plans)
        self.assertEqual((await self.read('WS 2026/27'))['favoriteCourseIds'], [])
        self.assertEqual(self.favorites()['WS 2025/26'], ['cs-42'])
        self.assertEqual(self.favorites()['SS 2026'], ['cs-99'])
        self.assertEqual(self.favorites()['__legacyCourseIds'], ['42', '99', '1107', 'not-a-number'])
        unchanged_plans = json.loads(self.database.execute('SELECT semester_plans_json FROM user_state').fetchone()[0])
        self.assertEqual(unchanged_plans, plans)
        self.assertEqual((await self.read('WS 2025/26'))['favoriteCourseIds'], ['42', '142'])

    async def test_first_write_migrates_legacy_without_losing_old_stars(self) -> None:
        self.store(['42'], {'SS 2026': {'courseIds': ['42']}})
        await self.write('WS 2026/27', ['99'])
        self.assertEqual(self.favorites()['SS 2026'], ['cs-42'])
        self.assertEqual(self.favorites()['WS 2026/27'], ['cs-99'])

    async def test_migration_compare_and_set_keeps_a_concurrent_write(self) -> None:
        self.store(['42'])
        async def concurrent_execute(env: Any, sql: str, params: list[Any]) -> None:
            self.database.execute('UPDATE user_state SET favorites_json = ?', [json.dumps({'SS 2026': ['cs-99']})])
            await self.execute(env, sql, params)
        with patch.object(user_favorites, 'execute', concurrent_execute):
            result = await self.read('SS 2026')
        self.assertEqual(result['favoriteCourseIds'], ['99'])

    async def test_semester_labels_are_validated_and_canonicalized(self) -> None:
        self.assertEqual((await self.write('ws 2026/2027', ['42']))['semesterLabel'], 'WS 2026/27')
        for invalid in ['', 'WS 2026/50', 'SS 2026.extra', None, 2026]:
            with self.subTest(label=invalid), self.assertRaises(user_favorites.FavoriteUpdateError):
                await self.write(invalid, [])

    async def test_numeric_ids_reject_booleans_fractions_and_invalid_values(self) -> None:
        for invalid in ['not-a-number', True, 1.5, None, -1, 0]:
            with self.subTest(value=invalid), self.assertRaises(user_favorites.FavoriteUpdateError):
                await self.write('SS 2026', [invalid])
        self.assertEqual(self.favorites(), {})

    async def test_legacy_migration_uses_running_term_not_upcoming_planning_term(self) -> None:
        with patch.object(user_favorites, 'get_simulated_semester_label', AsyncMock(return_value=None)):
            for month, expected in [(3, 'WS 2025/26'), (4, 'SS 2026'), (9, 'SS 2026'), (10, 'WS 2026/27')]:
                with self.subTest(month=month), patch.object(user_favorites, 'datetime') as clock:
                    clock.now.return_value = datetime(2026, month, 1, tzinfo=timezone.utc)
                    self.assertEqual(await user_favorites._current_semester_label(object()), expected)

    async def test_unscoped_old_clients_fail_closed_instead_of_pruning_a_plan(self) -> None:
        self.store(['42'])
        with self.assertRaisesRegex(user_favorites.FavoriteUpdateError, 'Reload the app'):
            await user_favorites.get_current_user_favorites(object(), object())
        with self.assertRaisesRegex(user_favorites.FavoriteUpdateError, 'Reload the app'):
            await user_favorites.replace_current_user_favorites(object(), object(), {'favoriteCourseIds': []})
        self.assertEqual(json.loads(self.database.execute('SELECT favorites_json FROM user_state').fetchone()[0]), ['42'])

    async def test_corrupt_storage_fails_instead_of_overwriting_history(self) -> None:
        self.database.execute("UPDATE user_state SET favorites_json = 'broken'")
        with self.assertRaises(user_favorites.FavoriteUpdateError):
            await self.write('SS 2026', ['42'])
        self.assertEqual(self.database.execute('SELECT favorites_json FROM user_state').fetchone()[0], 'broken')


if __name__ == '__main__':
    unittest.main()
