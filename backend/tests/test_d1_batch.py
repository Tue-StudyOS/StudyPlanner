import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

from db.d1 import D1ExecutionError, execute_batch  # noqa: E402


class FakeStatement:
    def __init__(self, sql: str) -> None:
        self.sql = sql
        self.params: tuple[object, ...] = ()

    def bind(self, *params: object) -> 'FakeStatement':
        self.params = params
        return self


class FakeDatabase:
    def __init__(self, results: list[object] | None = None, error: Exception | None = None) -> None:
        self.prepared: list[FakeStatement] = []
        self.results = results or []
        self.error = error
        self.batch_calls = 0

    def prepare(self, sql: str) -> FakeStatement:
        statement = FakeStatement(sql)
        self.prepared.append(statement)
        return statement

    async def batch(self, statements: list[FakeStatement]) -> list[object]:
        self.batch_calls += 1
        if self.error:
            raise self.error
        self.prepared = statements
        return self.results


class D1BatchTest(unittest.IsolatedAsyncioTestCase):
    async def test_prepares_and_sends_all_statements_in_one_batch(self) -> None:
        database = FakeDatabase(results=[{'success': True}, {'success': True}])

        result = await execute_batch(
            {'DB': database},
            [
                ('UPDATE example SET value = ? WHERE id = ?', [None, 7]),
                ('DELETE FROM example WHERE id = ?', [8]),
            ],
        )

        self.assertEqual(database.batch_calls, 1)
        self.assertEqual(len(database.prepared), 2)
        self.assertIn('value = NULL', database.prepared[0].sql)
        self.assertEqual(database.prepared[0].params, (7,))
        self.assertEqual(database.prepared[1].params, (8,))
        self.assertEqual(len(result), 2)

    async def test_batch_failure_is_reported_without_falling_back_to_individual_writes(self) -> None:
        database = FakeDatabase(error=RuntimeError('injected failure'))

        with self.assertRaisesRegex(D1ExecutionError, 'D1 batch failed'):
            await execute_batch(
                {'DB': database},
                [('DELETE FROM first_table', []), ('DELETE FROM second_table', [])],
            )

        self.assertEqual(database.batch_calls, 1)

if __name__ == '__main__':
    unittest.main()
