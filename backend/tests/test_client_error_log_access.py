import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import client_error_log  # noqa: E402


class ClientErrorLogAccessTest(unittest.IsolatedAsyncioTestCase):
    async def test_student_only_queries_entries_owned_by_their_username(self) -> None:
        fetch_all = AsyncMock(return_value=[])
        execute = AsyncMock()
        with (
            patch.object(client_error_log, 'execute', execute),
            patch.object(client_error_log, 'fetch_all', fetch_all),
        ):
            result = await client_error_log.list_client_errors({}, 'student@example.test')

        self.assertEqual(result, {'entries': [], 'scope': 'own'})
        sql = fetch_all.await_args.args[1]
        self.assertIn('WHERE user_username = ?', sql)
        self.assertEqual(fetch_all.await_args.args[2], ['student@example.test', 200])
        self.assertIn('DELETE FROM client_error_log', execute.await_args.args[1])

    async def test_configured_operator_can_query_aggregated_entries(self) -> None:
        fetch_all = AsyncMock(return_value=[])
        env = {'DIAGNOSTICS_ADMIN_USERNAMES': 'operator@example.test'}
        with (
            patch.object(client_error_log, 'execute', AsyncMock()),
            patch.object(client_error_log, 'fetch_all', fetch_all),
        ):
            result = await client_error_log.list_client_errors(env, 'operator@example.test')

        self.assertEqual(result, {'entries': [], 'scope': 'all'})
        sql = fetch_all.await_args.args[1]
        self.assertNotIn('WHERE user_username = ?', sql)
        self.assertEqual(fetch_all.await_args.args[2], [200])

    async def test_error_report_stores_username_not_the_removed_numeric_user_id(self) -> None:
        execute = AsyncMock()
        with (
            patch.object(client_error_log, 'get_authenticated_user', AsyncMock(return_value={'username': 'student@example.test'})),
            patch.object(client_error_log, 'execute', execute),
        ):
            await client_error_log.report_client_error(
                {},
                object(),
                {'method': 'GET', 'url': '/api/catalog/courses', 'status': 500, 'message': 'Failed'},
            )

        self.assertIn('DELETE FROM client_error_log', execute.await_args_list[0].args[1])
        insert_call = execute.await_args_list[1]
        self.assertIn('user_username', insert_call.args[1])
        self.assertEqual(insert_call.args[2][-1], 'student@example.test')


if __name__ == '__main__':
    unittest.main()
