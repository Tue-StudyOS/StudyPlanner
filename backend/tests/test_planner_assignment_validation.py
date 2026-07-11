from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import planner_assignments  # noqa: E402


class PlannerAssignmentValidationTest(unittest.IsolatedAsyncioTestCase):
    async def test_stale_assignments_are_dropped_without_rejecting_the_plan(self) -> None:
        rule_group = planner_assignments.RuleGroup('INFO', 'Info', 'elective', 6, 6, 1)
        option = planner_assignments.CourseOption(1, 'INFO', 'Info', 'elective', 1, 6)

        with (
            patch.object(
                planner_assignments,
                'load_rule_groups_for_regulation',
                AsyncMock(return_value={'INFO': rule_group}),
            ),
            patch.object(
                planner_assignments,
                'load_course_options_for_regulation',
                AsyncMock(return_value={1: [option], 2: []}),
            ),
        ):
            validated = await planner_assignments.validate_plan_course_assignments(
                {},
                {'profile': {'regulationVersionId': 7}},
                [1, 2],
                {'1': 'INFO', '2': 'INFO', '3': 'REMOVED'},
            )

        self.assertEqual(validated, {'1': 'INFO'})


if __name__ == '__main__':
    unittest.main()
