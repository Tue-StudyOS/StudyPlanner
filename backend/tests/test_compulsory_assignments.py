from __future__ import annotations

import json
import sqlite3
import sys
import types
import unittest
from contextlib import ExitStack
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))
workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import course_catalog, planner_assignments, progress, regulation_assignment_options, user_completed_courses  # noqa: E402


class CompulsoryAssignmentTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.addCleanup(self.db.close)
        self.db.executescript('''
            CREATE TABLE courses (id INTEGER, number TEXT, unit_id TEXT, title TEXT, course_type TEXT);
            CREATE TABLE regulation_versions (id INTEGER, code TEXT);
            CREATE TABLE study_programs (id INTEGER, code TEXT, name TEXT);
            CREATE TABLE study_program_regulation_versions (study_program_id INTEGER, regulation_version_id INTEGER);
            CREATE TABLE regulation_rule_groups (id INTEGER, regulation_version_id INTEGER, code TEXT,
                name TEXT, group_type TEXT, required_ects REAL, max_ects REAL, sort_order INTEGER);
            CREATE TABLE regulation_course_mappings (course_id INTEGER, regulation_version_id INTEGER,
                rule_group_id INTEGER, status TEXT, ects_counted REAL);
            CREATE TABLE curriculum_modules (id INTEGER, ects REAL, module_code TEXT, title TEXT, module_type TEXT, level TEXT);
            CREATE TABLE course_curriculum_matches (course_id INTEGER, module_id INTEGER);
            CREATE TABLE study_areas (id INTEGER, program_id INTEGER, code TEXT, area_type TEXT, name TEXT, sort_order INTEGER);
            CREATE TABLE module_study_area_options (module_id INTEGER, study_area_id INTEGER, status TEXT, ects_counted REAL);
            CREATE TABLE course_study_area_links (course_id INTEGER, study_area_id INTEGER);
            INSERT INTO courses VALUES (1194, 'INF2010', 'unit-math', 'Mathematik 3', NULL),
                (1197, 'INF2420', 'unit-theory', 'Theorie 1', NULL), (1200, 'SK100', NULL, 'Professional skills', NULL);
            INSERT INTO regulation_versions VALUES (1, 'BSC_INFO_2021'), (2, 'MSC_ML_2021');
            INSERT INTO study_programs VALUES (1, 'BSC_INFO_2021', 'Bachelor Informatik'), (2, 'MSC_ML_2021', 'Master ML');
            INSERT INTO study_program_regulation_versions VALUES (1, 1), (2, 2);
            INSERT INTO regulation_rule_groups VALUES
                (1, 1, 'INF', 'Mandatory', 'pflicht', 90, NULL, 1),
                (2, 1, 'INFO', 'Elective', 'wahlpflicht', 30, NULL, 2),
                (3, 1, 'UEBK', 'Skills', 'free_choice', 21, NULL, 3),
                (4, 2, 'ML-FOUND', 'Foundations', 'structured_elective', 24, NULL, 1),
                (5, 2, 'UEBK', 'Skills', 'free_choice', 6, NULL, 2);
            INSERT INTO curriculum_modules (id, ects) VALUES (1, 9), (2, 9), (3, 3), (4, 9);
            INSERT INTO course_curriculum_matches VALUES (1194, 1), (1197, 2), (1200, 3), (1194, 4);
            INSERT INTO study_areas (id, program_id, code, area_type, name, sort_order) VALUES
                (1, 1, 'MATH', 'pflicht', 'Math', 1), (2, 1, 'INF', 'pflicht', 'Informatik', 2),
                (3, 1, 'INFO', 'wahlpflicht', 'Wahl', 3), (4, 1, 'UEBK', 'free_choice', 'Skills', 4),
                (5, 2, 'ML-FOUND', 'structured_elective', 'Foundations', 1);
            INSERT INTO module_study_area_options VALUES (1, 1, 'allowed', 9),
                (2, 2, 'allowed', 9), (3, 4, 'required', 3), (4, 5, 'required', 9);
            INSERT INTO course_study_area_links VALUES (1194, 3), (1197, 3);
        ''')
        self.stored: list[dict[str, Any]] = []
        self.persist = AsyncMock(side_effect=self.save)
        stack = ExitStack()
        self.addCleanup(stack.close)
        for module in (course_catalog, regulation_assignment_options, user_completed_courses, progress, planner_assignments):
            stack.enter_context(patch.object(module, 'fetch_all', self.fetch))
        for module in (user_completed_courses, progress, planner_assignments):
            stack.enter_context(patch.object(module, 'load_user_progress_json', self.load))
        stack.enter_context(patch.object(user_completed_courses, '_persist_stored_completed_courses', self.persist))
        stack.enter_context(patch.object(user_completed_courses, 'require_authenticated_user', AsyncMock(return_value={
            'username': 'test', 'profile': {'regulationVersionId': 1},
        })))

    async def fetch(self, env: Any, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        return [dict(row) for row in self.db.execute(sql, params or [])]

    async def load(self, env: Any, username: str, field: str) -> str:
        return json.dumps(self.stored)

    async def save(self, env: Any, username: str, courses: list[dict[str, Any]]) -> None:
        self.stored = courses

    def course(self, **overrides: Any) -> dict[str, Any]:
        return {
            'id': 'keep-id', 'courseId': 1194, 'title': 'Mathematik 3', 'ects': 9,
            'studyAreaCode': 'INFO', 'masterCat': 'INFO', 'grade': 1.7,
            'semester': 'WS 2024/25', 'source': 'transcript_import', **overrides,
        }

    async def test_catalog_pflicht_overrides_same_program_cross_listings(self) -> None:
        options = await regulation_assignment_options.load_regulation_course_options({}, 1, [1194, 1197, 1200], allowed_only=True)
        self.assertEqual([option['studyAreaCode'] for option in options[1194]], ['INF'])
        self.assertEqual([option['studyAreaCode'] for option in options[1197]], ['INF'])
        self.assertTrue(options[1194][0]['isCompulsory'])
        # An individually required skills component legitimately stays in ÜBK.
        self.assertEqual([option['studyAreaCode'] for option in options[1200]], ['UEBK'])
        self.assertTrue(options[1200][0]['isCompulsory'])
        other_program = await regulation_assignment_options.load_regulation_course_options({}, 2, [1194])
        self.assertEqual([option['studyAreaCode'] for option in other_program[1194]], ['ML-FOUND'])
        self.assertFalse(other_program[1194][0]['isCompulsory'])

    async def test_import_and_put_reject_incompatible_compulsory_selections(self) -> None:
        result = await user_completed_courses.import_current_user_completed_courses({}, object(), {
            'imports': [{'id': 'bad', 'course': self.course(courseId=1197, title='Theorie 1', studyAreaCode='UEBK')}],
        })
        self.assertEqual(result['failedCount'], 1)
        self.assertEqual(self.stored, [])
        with self.assertRaisesRegex(user_completed_courses.CompletedCourseUpdateError, 'Compulsory'):
            await user_completed_courses.replace_current_user_completed_courses({}, object(), {
                'completedCourses': [self.course()],
            })

    async def test_read_repair_is_shared_read_only_and_preserves_course_details(self) -> None:
        self.stored = [self.course()]
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertEqual(serialized[0]['studyAreaCode'], 'INF')
        self.assertEqual(serialized[0]['masterCat'], 'BASIS')
        self.assertTrue(serialized[0]['categoryLocked'])
        self.assertTrue(serialized[0]['assignmentRestricted'])
        self.assertEqual([option['studyAreaCode'] for option in serialized[0]['availableStudyAreaOptions']], ['INF'])
        for field in ('id', 'title', 'grade', 'semester', 'ects'):
            self.assertEqual(serialized[0][field], self.stored[0][field])
        progress_courses = await progress._load_completed_courses_for_progress({}, 'test', 1)
        self.assertEqual(progress_courses[0]['studyAreaCode'], 'INF')
        groups = await planner_assignments.load_rule_groups_for_regulation({}, 1)
        totals, _ = await planner_assignments._load_completed_ects_by_area({}, 'test', groups, 1)
        self.assertEqual(totals, {'INF': 9, 'INFO': 0, 'UEBK': 0})
        options = await planner_assignments.load_course_options_for_regulation({}, 1, [1194])
        self.assertEqual([option.area_code for option in options[1194]], ['INF'])
        optimization = await user_completed_courses.get_current_user_anrechnung_optimization({}, object())
        self.assertEqual(optimization['changes'], [])
        self.assertEqual(self.stored[0]['studyAreaCode'], 'INFO')
        self.persist.assert_not_awaited()

    async def test_put_repairs_only_unchanged_certain_assignment_and_import_persists_repairs(self) -> None:
        self.stored = [self.course()]
        await user_completed_courses.replace_current_user_completed_courses({}, object(), {'completedCourses': [self.course()]})
        self.assertEqual(self.stored[0]['studyAreaCode'], 'INF')
        self.assertEqual(self.stored[0]['id'], 'keep-id')
        with self.assertRaisesRegex(user_completed_courses.CompletedCourseUpdateError, 'Compulsory'):
            await user_completed_courses.replace_current_user_completed_courses({}, object(), {
                'completedCourses': [self.course(studyAreaCode='UEBK')],
            })
        self.stored = [self.course()]
        await user_completed_courses.import_current_user_completed_courses({}, object(), {'imports': []})
        self.assertEqual(self.stored[0]['studyAreaCode'], 'INF')
        self.assertEqual(self.stored[0]['masterCat'], 'BASIS')

    async def test_ambiguous_invalid_assignment_is_flagged_and_not_credited(self) -> None:
        self.db.execute("INSERT INTO module_study_area_options VALUES (1, 4, 'required', 9)")
        self.stored = [self.course()]
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertFalse(serialized[0]['assignmentNeedsReview'])
        self.assertFalse(serialized[0]['isGradeCounted'])
        self.assertEqual(serialized[0]['studyAreaCode'], 'INF')
        self.assertTrue(serialized[0]['categoryLocked'])
        groups = await planner_assignments.load_rule_groups_for_regulation({}, 1)
        totals, _ = await planner_assignments._load_completed_ects_by_area({}, 'test', groups, 1)
        self.assertEqual(totals, {'INF': 9, 'INFO': 0, 'UEBK': 0})
        progress_courses = await progress._load_completed_courses_for_progress({}, 'test', 1)
        areas = await progress._build_regulation_progress({}, 1, 'BSC_INFO_2021', progress_courses)
        self.assertEqual(next(area['earnedEcts'] for area in areas if area['code'] == 'INF'), 9)
        self.assertEqual(progress._compute_average_grade(progress_courses), 1.7)
        self.stored = [self.course(studyAreaCode='UEBK')]
        valid = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertEqual(valid[0]['studyAreaCode'], 'INF')
        self.assertFalse(valid[0]['assignmentNeedsReview'])
        self.persist.assert_not_awaited()

    async def test_reseeded_unknowns_and_ambiguous_destinations_are_not_guessed(self) -> None:
        unknown = self.course(id='unknown', title='Old unrelated course', externalCourseCode='OLD123')
        self.stored = [unknown, self.course()]
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        by_id = {course['id']: course for course in serialized}
        self.assertEqual(by_id['unknown']['studyAreaCode'], 'INFO')
        self.assertEqual(by_id['unknown']['courseNumber'], 'INF2010')
        self.assertTrue(by_id['unknown']['assignmentRestricted'])
        self.assertTrue(by_id['unknown']['assignmentNeedsReview'])
        self.assertEqual(by_id['keep-id']['studyAreaCode'], 'INF')
        trusted_code = self.course(title='Legacy title', externalCourseCode='INF2010')
        repaired = await regulation_assignment_options.canonicalize_completed_courses({}, 1, [trusted_code])
        self.assertEqual(repaired[0]['studyAreaCode'], 'INFO')
        self.assertTrue(repaired[0]['assignmentNeedsReview'])
        self.db.execute("INSERT INTO module_study_area_options VALUES (1, 4, 'required', 9)")
        ambiguous = await regulation_assignment_options.canonicalize_completed_courses({}, 1, [self.course()])
        self.assertEqual(ambiguous[0]['studyAreaCode'], 'INF')
        malformed = {'courseId': 'not-numeric', 'title': 'Unknown', 'studyAreaCode': 'INFO'}
        self.assertEqual(await regulation_assignment_options.canonicalize_completed_courses({}, 1, [malformed]), [malformed])

    async def test_official_formal_module_alias_trusts_normalized_catalog_title_but_rejects_contradictions(self) -> None:
        self.db.execute(
            "INSERT INTO courses VALUES (1501, 'INF1020-V', 'unit-math2', 'INF1020-V Lineare Algebra (Vorlesung)', 'Vorlesung')",
        )
        formal_alias = self.course(
            id='formal-math', courseId=1501, courseNumber='INFM1020',
            externalCourseCode='INFM1020', title='INFM1020 Lineare Algebra',
        )
        trusted = await regulation_assignment_options.load_trusted_completed_course_options({}, 1, [formal_alias])
        self.assertFalse(trusted[regulation_assignment_options.completed_identity_key(formal_alias)][0].get('identityNeedsReview'))
        repaired = await regulation_assignment_options.canonicalize_completed_courses({}, 1, [formal_alias])
        self.assertFalse(repaired[0].get('assignmentNeedsReview', False))
        self.assertEqual(repaired[0]['studyAreaCode'], 'INF')

        contradictory_title = {**formal_alias, 'title': 'Unrelated module'}
        rejected = await regulation_assignment_options.load_trusted_completed_course_options(
            {}, 1, [contradictory_title],
        )
        self.assertTrue(rejected[regulation_assignment_options.completed_identity_key(contradictory_title)][0].get('identityNeedsReview'))
        contradictory_code = {**formal_alias, 'externalCourseCode': 'UNRELATED-COURSE'}
        rejected_code = await regulation_assignment_options.load_trusted_completed_course_options(
            {}, 1, [contradictory_code],
        )
        self.assertTrue(rejected_code[regulation_assignment_options.completed_identity_key(contradictory_code)][0].get('identityNeedsReview'))

    async def test_serialized_rows_round_trip_with_enriched_codes_and_missing_catalog_identity(self) -> None:
        self.stored = [self.course(), self.course(id='missing', courseId=9999, title='Removed historic course')]
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        by_id = {course['id']: course for course in serialized}
        self.assertEqual(by_id['keep-id']['courseNumber'], 'INF2010')
        self.assertEqual(by_id['keep-id']['studyAreaCode'], 'INF')
        self.assertTrue(by_id['missing']['assignmentNeedsReview'])
        result = await user_completed_courses.replace_current_user_completed_courses({}, object(), {'completedCourses': serialized})
        by_id = {course['id']: course for course in result['completedCourses']}
        self.assertEqual(by_id['keep-id']['studyAreaCode'], 'INF')
        self.assertTrue(by_id['missing']['assignmentNeedsReview'])
        self.assertEqual(by_id['missing']['studyAreaCode'], 'INFO')

    async def test_shared_queries_and_bulk_reads_stay_under_d1_bind_limit(self) -> None:
        self.db.setlimit(sqlite3.SQLITE_LIMIT_VARIABLE_NUMBER, 100)
        ids = list(range(2000, 2125))
        self.db.executemany('INSERT INTO courses VALUES (?, ?, NULL, ?, NULL)', [
            (course_id, f'INF{course_id}', f'Course {course_id}') for course_id in ids
        ])
        self.db.executemany('INSERT INTO regulation_course_mappings VALUES (?, 1, 1, ?, 9)', [
            (course_id, 'allowed') for course_id in ids
        ])
        self.db.executemany('INSERT INTO course_curriculum_matches VALUES (?, 1)', [(course_id,) for course_id in ids])
        self.db.executemany('INSERT INTO course_study_area_links VALUES (?, 3)', [(course_id,) for course_id in ids])
        courses = [self.course(id=str(course_id), courseId=course_id, title=f'Course {course_id}',
                               externalCourseCode=f'INF{course_id}') for course_id in ids]
        options = await regulation_assignment_options.load_regulation_course_options({}, 1, ids, allowed_only=True)
        self.assertEqual(len(options), 125)
        self.assertTrue(all([option['studyAreaCode'] for option in row] == ['INF'] for row in options.values()))
        self.stored = courses
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertEqual(len(serialized), 125)
        self.assertTrue(all(course['studyAreaCode'] == 'INF' for course in serialized))
        completed = await progress._load_completed_courses_for_progress({}, 'test', 1)
        areas = await progress._build_regulation_progress({}, 1, 'BSC_INFO_2021', completed)
        self.assertEqual(sum(area['earnedEcts'] for area in areas), 1125)
        planner_options = await planner_assignments.load_course_options_for_regulation({}, 1, ids)
        self.assertEqual(len(planner_options), 125)
        with patch.object(planner_assignments, '_fetch_catalog_courses_by_ids', AsyncMock(return_value=[
            {'id': course_id, 'title': f'Course {course_id}'} for course_id in ids
        ])):
            self.assertEqual(len(await planner_assignments._load_planned_courses(
                {}, ids, planner_options, 'BSC_INFO_2021',
            )), 125)
        await user_completed_courses.replace_current_user_completed_courses({}, object(), {'completedCourses': courses})
        self.assertTrue(all(course['studyAreaCode'] == 'INF' for course in self.stored))
        result = await user_completed_courses.import_current_user_completed_courses({}, object(), {
            'imports': [{'id': str(index), 'course': course} for index, course in enumerate(courses)],
        })
        self.assertEqual(result['failedCount'], 125)  # Explicit stale INFO placements are still rejected.

    async def test_conflicting_and_generic_identity_never_repair_or_block_unrelated_saves(self) -> None:
        self.db.execute("INSERT INTO courses VALUES (1300, 'GENERIC', NULL, 'Another course', NULL)")
        self.db.execute("UPDATE courses SET number = 'GENERIC' WHERE id = 1194")
        uncertain = [
            self.course(id='conflicting-code', externalCourseCode='OLD123'),
            self.course(id='generic-code', externalCourseCode='GENERIC', title='Different historic course'),
            self.course(id='two-codes', externalCourseCode='GENERIC', courseNumber='OLD123'),
        ]
        self.stored = uncertain
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertTrue(all(course['assignmentNeedsReview'] for course in serialized))
        self.assertTrue(all(course['studyAreaCode'] == 'INFO' for course in serialized))
        self.assertTrue(all(course['availableStudyAreaOptions'] == [] for course in serialized))
        completed = await progress._load_completed_courses_for_progress({}, 'test', 1)
        self.assertTrue(all(course['courseNumber'] is None for course in completed if course['id'] != 'two-codes'))
        self.assertEqual(next(course for course in completed if course['id'] == 'two-codes')['courseNumber'], 'OLD123')
        result = await user_completed_courses.import_current_user_completed_courses({}, object(), {
            'imports': [{'id': 'new-catalog-pick', 'course': self.course(externalCourseCode='GENERIC', studyAreaCode='INF')}],
        })
        self.assertEqual(result['failedCount'], 1)
        self.assertEqual(sorted((course['id'], course['title'], course['studyAreaCode']) for course in self.stored),
                         sorted((course['id'], course['title'], course['studyAreaCode']) for course in uncertain))
        valid = self.course(id='unrelated', courseId=1200, title='Professional skills', studyAreaCode='UEBK', masterCat='BASIS')
        await user_completed_courses.replace_current_user_completed_courses({}, object(), {'completedCourses': [*uncertain, valid]})
        by_id = {course['id']: course for course in self.stored}
        self.assertTrue(all(by_id[course['id']]['studyAreaCode'] == 'INFO' for course in uncertain))
        self.assertEqual(by_id['unrelated']['studyAreaCode'], 'UEBK')
        with self.assertRaisesRegex(user_completed_courses.CompletedCourseUpdateError, 'needs review'):
            await user_completed_courses.replace_current_user_completed_courses({}, object(), {
                'completedCourses': [{**uncertain[0], 'studyAreaCode': 'UEBK'}],
            })

    async def test_unknown_compulsory_evidence_stays_restricted_and_unchanged_rows_survive_put(self) -> None:
        self.db.execute("UPDATE study_areas SET code = 'UNKNOWN-MANDATORY' WHERE id = 1")
        self.stored = [self.course()]
        row = (await user_completed_courses._serialize_completed_courses({}, 'test', 1))[0]
        self.assertEqual(row['studyAreaCode'], 'INF')
        self.assertTrue(row['assignmentRestricted'])
        self.assertFalse(row['assignmentNeedsReview'])
        self.assertTrue(row['categoryLocked'])
        self.assertEqual([option['studyAreaCode'] for option in row['availableStudyAreaOptions']], ['INF'])
        self.assertEqual([option.area_code for option in (await planner_assignments.load_course_options_for_regulation({}, 1, [1194]))[1194]], ['INF'])
        completed = await progress._load_completed_courses_for_progress({}, 'test', 1)
        areas = await progress._build_regulation_progress({}, 1, 'BSC_INFO_2021', completed)
        self.assertEqual(next(area['earnedEcts'] for area in areas if area['code'] == 'INF'), 9)
        optimization = await user_completed_courses.get_current_user_anrechnung_optimization({}, object())
        self.assertEqual(optimization['before']['creditedEcts'], 9)
        self.assertEqual(optimization['changes'], [])
        self.persist.assert_not_awaited()
        valid = self.course(id='unrelated', courseId=1200, title='Professional skills', studyAreaCode='UEBK', masterCat='BASIS')
        await user_completed_courses.replace_current_user_completed_courses({}, object(), {
            'completedCourses': [self.course(), valid],
        })
        self.assertEqual(next(course for course in self.stored if course['id'] == 'keep-id')['studyAreaCode'], 'INF')
        for code in ('UEBK', 'INFO', 'UNKNOWN-MANDATORY'):
            result = await user_completed_courses.import_current_user_completed_courses({}, object(), {
                'imports': [{'id': 'bad', 'course': self.course(id='new', studyAreaCode=code)}],
            })
            self.assertEqual(result['failedCount'], 1)
        with self.assertRaises(user_completed_courses.CompletedCourseUpdateError):
            await user_completed_courses.replace_current_user_completed_courses({}, object(), {
                'completedCourses': [self.course(studyAreaCode='UEBK')],
            })
    async def test_ambiguous_existing_rows_survive_unrelated_saves_and_optimizer_proposes_resolution(self) -> None:
        self.db.execute("INSERT INTO module_study_area_options VALUES (1, 4, 'required', 9)")
        self.stored = [self.course()]
        optimization = await user_completed_courses.get_current_user_anrechnung_optimization({}, object())
        self.assertEqual(optimization['before']['creditedEcts'], 9)
        self.assertEqual(optimization['after']['creditedEcts'], 9)
        self.assertFalse(optimization['hasImprovement'])
        self.assertEqual(len(optimization['changes']), 0)
        await user_completed_courses.replace_current_user_completed_courses({}, object(), {'completedCourses': [self.course()]})
        self.assertEqual(self.stored[0]['studyAreaCode'], 'INF')
        serialized = await user_completed_courses._serialize_completed_courses({}, 'test', 1)
        self.assertFalse(serialized[0]['assignmentNeedsReview'])

    async def test_generic_uebk_required_bucket_is_not_an_individually_required_component(self) -> None:
        self.db.execute("UPDATE study_areas SET area_type = 'pflicht' WHERE code = 'UEBK'")
        self.db.execute("UPDATE module_study_area_options SET status = 'allowed' WHERE module_id = 3")
        self.db.execute("INSERT INTO course_study_area_links VALUES (1200, 3)")
        options = await regulation_assignment_options.load_regulation_course_options({}, 1, [1200])
        self.assertEqual({option['studyAreaCode'] for option in options[1200]}, {'UEBK', 'INFO'})
        self.assertTrue(all(not option['isCompulsory'] for option in options[1200]))
        result = await user_completed_courses.import_current_user_completed_courses({}, object(), {
            'imports': [{'id': 'generic', 'course': self.course(courseId=1200, title='Professional skills')}],
        })
        self.assertEqual(result['importedCount'], 1)
        self.db.execute("UPDATE module_study_area_options SET status = 'required' WHERE module_id = 3")
        options = await regulation_assignment_options.load_regulation_course_options({}, 1, [1200])
        self.assertEqual([option['studyAreaCode'] for option in options[1200]], ['UEBK'])
        self.assertTrue(options[1200][0]['isCompulsory'])

    async def test_excluded_metadata_does_not_make_courses_compulsory(self) -> None:
        for status in ('blocked', 'excluded', 'forbidden'):
            self.db.execute('UPDATE module_study_area_options SET status = ? WHERE module_id = 1', (status,))
            options = await regulation_assignment_options.load_regulation_course_options({}, 1, [1194])
            self.assertEqual([option['studyAreaCode'] for option in options[1194]], ['INF'])
            self.assertTrue(options[1194][0]['isCompulsory'])


if __name__ == '__main__':
    unittest.main()
