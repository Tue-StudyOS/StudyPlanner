import io
import json
import sys
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')


class WorkerEntrypoint:
    pass


workers.WorkerEntrypoint = WorkerEntrypoint
workers.Response = object
sys.modules['workers'] = workers

import main  # noqa: E402


class ScheduledCleanupTest(unittest.IsolatedAsyncioTestCase):
    async def test_scheduled_handler_logs_only_aggregate_counts(self) -> None:
        counts = {
            'clientDiagnosticsDeleted': 2,
            'feedbackDeleted': 3,
            'rateLimitsDeleted': 4,
            'hiddenReviewsDeleted': 5,
        }
        output = io.StringIO()

        with (
            patch.object(main, 'run_retention_cleanup', AsyncMock(return_value=counts)) as cleanup,
            redirect_stdout(output),
        ):
            await main.Default().on_scheduled(object(), {'DB': object()}, object())

        cleanup.assert_awaited_once_with({'DB': unittest.mock.ANY})
        self.assertEqual(
            json.loads(output.getvalue()),
            {'event': 'retention_cleanup', **counts},
        )


if __name__ == '__main__':
    unittest.main()
