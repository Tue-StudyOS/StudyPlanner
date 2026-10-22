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
    async def test_catalog_electives_offer_the_same_flexible_targets_as_the_ui(self) -> None:
        groups = {
            'INF': {'name': 'Mandatory', 'groupType': 'pflicht'},
            'INFO': {'name': 'Elective', 'groupType': 'wahlpflicht'},
            'THEO': {'name': 'Theory', 'groupType': 'wahlpflicht'},
            'UEBK': {'name': 'Skills', 'groupType': 'free_choice'},
            'THESIS': {'name': 'Thesis', 'groupType': 'thesis'},
        }
        rows = {
            1: [{'studyAreaCode': 'INFO', 'ectsCounted': 6}],
            2: [{'studyAreaCode': 'INF', 'isCompulsory': True, 'ectsCounted': 9}],
            3: [{'studyAreaCode': 'UNKNOWN', 'isCompulsory': True, 'isResolved': False}],
        }
        with (
            patch.object(planner_assignments, 'load_regulation_course_options', AsyncMock(return_value=rows)),
            patch.object(planner_assignments, 'load_regulation_rule_groups', AsyncMock(return_value=groups)),
            patch.object(planner_assignments, '_load_catalog_categories', AsyncMock(return_value={1: {'INFO'}, 2: {'BASIS'}, 3: {'INFO'}, 5: {'THEO'}})),
        ):
            options = await planner_assignments.load_course_options_for_regulation({}, 7, [1, 2, 3, 4, 5])
        self.assertEqual({option.area_code for option in options[1]}, {'INFO', 'UEBK'})
        self.assertEqual([option.area_code for option in options[2]], ['INF'])
        self.assertNotIn(3, options)
        self.assertNotIn(4, options)
        self.assertEqual({option.area_code for option in options[5]}, {'INFO', 'THEO', 'UEBK'})

    async def test_catalog_only_credits_keep_automatic_assignments_capacity_safe(self) -> None:
        groups = {
            'INFO': planner_assignments.RuleGroup('INFO', 'Info', 'elective', 9, 9, 1),
            'UEBK': planner_assignments.RuleGroup('UEBK', 'Skills', 'free_choice', 6, 6, 2),
        }
        options = {1: [
            planner_assignments.CourseOption(1, 'INFO', 'Info', 'elective', 1, 9),
            planner_assignments.CourseOption(1, 'UEBK', 'Skills', 'free_choice', 2, 0),
        ]}
        with patch.object(planner_assignments, '_fetch_catalog_courses_by_ids', AsyncMock(return_value=[
            {'id': 1, 'title': 'Catalog-only course'},
        ])):
            courses = await planner_assignments._load_planned_courses({}, [1], options, 'BSC_INFO_2021')
        result = planner_assignments._balance_assignments([1], courses, options, {}, set(), groups, {'1': 'UEBK'})
        self.assertEqual(result[0], {'1': 'INFO'})
        self.assertEqual(result[3][0]['plannedEcts'], 9)
        self.assertEqual(result[3][1]['plannedEcts'], 0)
        unknown = {1: [options[1][1]]}
        with patch.object(planner_assignments, '_fetch_catalog_courses_by_ids', AsyncMock(return_value=[
            {'id': 1, 'title': 'Unknown credits'},
        ])):
            courses = await planner_assignments._load_planned_courses({}, [1], unknown, 'BSC_INFO_2021')
        result = planner_assignments._balance_assignments([1], courses, unknown, {}, set(), groups, {})
        self.assertEqual(result[0], {})
        self.assertEqual(result[2], ['1'])
        self.assertFalse(result[4])

    async def test_tree_credits_resolve_for_the_selected_program(self) -> None:
        row = {'id': 1, 'title': 'Tree credits', 'catalogTreePathsJson':
               '[["BSc-INFM-21-VG1 Course (9 CP)", "Course"], ["MScInfo-21-VG2 Course (12 CP)", "Course"]]'}
        with patch.object(planner_assignments, '_fetch_catalog_courses_by_ids', AsyncMock(return_value=[row])):
            courses = await planner_assignments._load_planned_courses({}, [1], {}, 'BSC_INFO_2021')
        self.assertEqual(courses[1].ects, 9)

    async def test_overflow_survives_each_save_while_swapping_full_areas(self) -> None:
        groups = {
            code: planner_assignments.RuleGroup(code, code, 'elective', 6, 6, index)
            for index, code in enumerate(('INFO', 'UEBK'))
        }
        options = {
            course_id: [planner_assignments.CourseOption(course_id, code, code, 'elective', 1, 6)
                        for code in groups]
            for course_id in (1, 2)
        }
        with (
            patch.object(planner_assignments, 'load_rule_groups_for_regulation', AsyncMock(return_value=groups)),
            patch.object(planner_assignments, 'load_course_options_for_regulation', AsyncMock(return_value=options)),
        ):
            user = {'profile': {'regulationVersionId': 7}}
            first_save = await planner_assignments.validate_plan_course_assignments(
                {}, user, [1, 2], {'1': 'UEBK', '2': 'UEBK'},
            )
            self.assertEqual(first_save, {'1': 'UEBK', '2': 'UEBK'})
            second_save = await planner_assignments.validate_plan_course_assignments(
                {}, user, [1, 2], {**first_save, '2': 'INFO'},
            )
            self.assertEqual(second_save, {'1': 'UEBK', '2': 'INFO'})
        courses = {course_id: planner_assignments.PlannedCourse(course_id, str(course_id), 6)
                   for course_id in (1, 2)}
        automatic, _, unassigned, summary, strict = planner_assignments._balance_assignments(
            [1, 2], courses, options, {}, set(), groups, first_save,
        )
        self.assertTrue(strict)
        self.assertEqual(unassigned, [])
        self.assertEqual(set(automatic.values()), {'INFO', 'UEBK'})
        self.assertTrue(all(area['plannedEcts'] <= 6 for area in summary))

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

    async def test_ml_general_cs_is_not_inferred_from_generic_ml_categories(self) -> None:
        groups = {
            code: {'name': code, 'groupType': 'elective_area'}
            for code in ('ML-FOUND', 'ML-DIVERSE', 'ML-CS', 'ML-EXP', 'THESIS')
        }
        rows = {1: [
            {'studyAreaCode': 'ML-CS', 'studyAreaName': 'General CS'},
            {'studyAreaCode': 'ML-FOUND', 'studyAreaName': 'Foundations'},
        ]}
        with (
            patch.object(planner_assignments, 'load_regulation_course_options', AsyncMock(return_value=rows)),
            patch.object(planner_assignments, 'load_regulation_rule_groups', AsyncMock(return_value=groups)),
            patch.object(planner_assignments, '_load_catalog_categories', AsyncMock(return_value={1: {'BASIS'}})),
            patch.object(planner_assignments, '_load_ml_general_cs_eligible_course_ids', AsyncMock(return_value=set())),
        ):
            options = await planner_assignments.load_course_options_for_regulation(
                {}, 7, [1], study_program_code='MSC_ML_2021',
            )
        self.assertEqual({option.area_code for option in options[1]}, {'ML-FOUND'})

    async def test_info_basis_areas_require_the_profile_confirmation(self) -> None:
        groups = {
            code: {'name': code, 'groupType': 'elective_area'}
            for code in ('INFO-PRAK', 'INFO-TECH', 'INFO-THEO', 'INFO-INFO',
                         'INFO-FOKUS', 'INFO-BASIS', 'THESIS')
        }
        rows = {1: [{'studyAreaCode': 'INFO-BASIS', 'studyAreaName': 'BASIS'}]}
        with (
            patch.object(planner_assignments, 'load_regulation_course_options', AsyncMock(return_value=rows)),
            patch.object(planner_assignments, 'load_regulation_rule_groups', AsyncMock(return_value=groups)),
            patch.object(planner_assignments, '_load_catalog_categories', AsyncMock(return_value={1: {'INFO'}})),
        ):
            options = await planner_assignments.load_course_options_for_regulation(
                {}, 7, [1], study_program_code='MSC_INFO_2021',
            )
            confirmed_options = await planner_assignments.load_course_options_for_regulation(
                {}, 7, [1], study_program_code='MSC_INFO_2021',
                msc_info_basis_admission_confirmed=True,
            )
        self.assertNotIn('INFO-BASIS', {option.area_code for option in options[1]})
        self.assertIn('INFO-BASIS', {option.area_code for option in confirmed_options[1]})


if __name__ == '__main__':
    unittest.main()
