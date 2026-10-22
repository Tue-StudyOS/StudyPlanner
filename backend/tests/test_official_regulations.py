from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

from services.user_completed_courses import (  # noqa: E402
    CompletedCourseUpdateError,
    _normalize_completed_course,
    _normalize_grade,
)
from services.official_regulations import (  # noqa: E402
    AREA_DEFINITIONS,
    achievement_identity,
    assessment_type,
    assignment_limit_error,
    canonical_module_code,
    compute_credit_accounting,
    find_duplicate_achievements,
    get_official_regulation,
    grade_is_counted,
    truncate_official_grade,
)


class OfficialRegulationTest(unittest.TestCase):
    def test_all_six_official_degree_structures_reconcile(self) -> None:
        expected = {
            'BSC_INFO_2021': (180, [114, 6, 6, 6, 15, 18, 15]),
            'BSC_BIOINFO_2021': (180, [33, 51, 15, 39, 6, 6, 6, 9, 15]),
            'BSC_MEDIENINFO_2021': (180, [27, 60, 39, 9, 12, 12, 6, 15]),
            'BSC_MEDIZININFO_2021': (180, [21, 45, 30, 39, 6, 6, 12, 6, 15]),
            'MSC_INFO_2021': (120, [18, 18, 18, 18, 18, 18, 30]),
            'MSC_ML_2021': (120, [24, 36, 18, 12, 30]),
        }
        for program, (degree_total, area_amounts) in expected.items():
            with self.subTest(program=program):
                policy = get_official_regulation(program)
                self.assertIsNotNone(policy)
                assert policy is not None
                self.assertEqual(policy['totalEcts'], degree_total)
                self.assertEqual([area['requiredEcts'] for area in policy['ruleGroups']], area_amounts)
                effective_total = sum(area_amounts)
                if program == 'MSC_INFO_2021':
                    effective_total -= 18
                self.assertEqual(effective_total, degree_total)

    def test_complete_degree_accounting_for_all_six_profiles(self) -> None:
        for code in AREA_DEFINITIONS:
            with self.subTest(program=code):
                policy = get_official_regulation(code)
                assert policy is not None
                rows: list[dict[str, object]] = []
                for group in policy['ruleGroups']:
                    if group['code'] == 'INFO-BASIS':
                        continue
                    modules = group['modules'] if group['groupType'] == 'pflicht' or group['code'] == 'THESIS' else []
                    modules = modules or [{
                        'code': 'synthetic-' + group['code'],
                        'name': 'Abschlussmodul' if group['code'] == 'THESIS' else 'Approved elective module',
                        'ects': group['requiredEcts'],
                    }]
                    for module in modules:
                        rows.append({
                            'id': module['code'], 'courseNumber': module['code'],
                            'moduleCode': module['code'], 'title': module['name'],
                            'ects': module['ects'], 'grade': 1.3, 'courseType': 'Vorlesung',
                            'studyAreaCode': group['code'], 'allowedAreaCodes': [group['code']],
                        })
                result = compute_credit_accounting(code, rows)
                self.assertEqual(result['degreeCountedEcts'], policy['totalEcts'])
                self.assertEqual(result['degreeGrade'], 1.3)
                self.assertEqual(result['missingRequiredModules'], [])
                self.assertEqual(result['missingRequiredAreas'], [])
                self.assertEqual(sum(row['degreeCountedEcts'] for row in result['courseAccounting'].values()), policy['totalEcts'])
                expected_grade_credits = 108 if code == 'MSC_ML_2021' else policy['totalEcts']
                self.assertEqual(result['gradeCountedEcts'], expected_grade_credits)

    def test_program_specific_math_iv_and_math_structure(self) -> None:
        self.assertEqual(canonical_module_code('BSC_INFO_2021', 'MAT-95-41'), 'INFM2020')
        self.assertEqual(canonical_module_code('BSC_INFO_2021', 'MAT-95-42'), 'INFM2020')
        self.assertEqual(canonical_module_code('BSC_BIOINFO_2021', 'MAT-95-41'), None)
        self.assertEqual(canonical_module_code('BSC_BIOINFO_2021', 'MAT-95-42'), 'BIOINFM2021')
        self.assertEqual(canonical_module_code('BSC_MEDIENINFO_2021', 'INFM1010'), 'INFM1010')
        self.assertEqual(canonical_module_code('BSC_MEDIZININFO_2021', 'MDZINFM2310'), 'MDZINFM2310')

    def test_missing_required_modules_reported_not_hidden_by_area_total(self) -> None:
        result = compute_credit_accounting('BSC_MEDIENINFO_2021', [
            {'id': '1', 'courseNumber': 'INFM1010', 'ects': 9, 'grade': 1.7, 'studyAreaCode': 'MATH'},
            {'id': '2', 'courseNumber': 'INFM1020', 'ects': 9, 'grade': 1.7, 'studyAreaCode': 'MATH'},
            {'id': '3', 'courseNumber': 'MAT-95-41', 'ects': 6, 'grade': 1.7, 'studyAreaCode': 'MATH'},
        ])
        self.assertIn('INFM2010', result['missingRequiredModules'])
        self.assertEqual(result['uniqueEarnedEcts'], 24)

    def test_fixed_module_aliases_count_once_but_different_seminars_do_not(self) -> None:
        courses = [
            {'id': 'old', 'courseNumber': 'INF1020-V', 'ects': 9, 'grade': 1.3, 'studyAreaCode': 'INF'},
            {'id': 'new', 'courseNumber': 'INFM1020', 'ects': 9, 'grade': 1.3, 'studyAreaCode': 'INF'},
            {'id': 's1', 'courseNumber': 'SEMINAR-A', 'ects': 3, 'grade': 1.7, 'studyAreaCode': 'INFO', 'allowedAreaCodes': ['INFO']},
            {'id': 's2', 'courseNumber': 'SEMINAR-B', 'ects': 3, 'grade': 2.0, 'studyAreaCode': 'INFO', 'allowedAreaCodes': ['INFO']},
        ]
        result = compute_credit_accounting('BSC_INFO_2021', courses)
        self.assertEqual(result['recordedEcts'], 24)
        self.assertEqual(result['uniqueEarnedEcts'], 15)
        self.assertIn({'achievementId': 'new', 'reasons': ['duplicate_achievement']}, result['reviewReasons'])
        self.assertEqual(result['courseAccounting']['old']['earnedEcts'], 9)
        self.assertEqual(result['courseAccounting']['old']['uniqueEarnedEcts'], 9)
        self.assertEqual(result['courseAccounting']['new']['uniqueEarnedEcts'], 0)
        self.assertIn('duplicate_achievement', result['courseAccounting']['new']['reviewReasons'])
        self.assertNotEqual(achievement_identity(courses[2], 'BSC_INFO_2021'),
                            achievement_identity(courses[3], 'BSC_INFO_2021'))

    def test_conflicting_duplicate_grades_keep_unique_earned_credit_but_withhold_gpa(self) -> None:
        courses = [
            {'id': 'a', 'courseNumber': 'INF1120', 'ects': 9, 'grade': 1.0},
            {'id': 'b', 'courseNumber': 'INFM1120', 'ects': 9, 'grade': 4.0},
        ]
        result = compute_credit_accounting('BSC_INFO_2021', courses)
        self.assertEqual(result['recordedEcts'], 18)
        self.assertEqual(result['uniqueEarnedEcts'], 9)
        self.assertEqual(result['degreeCountedEcts'], 0)
        self.assertEqual(result['gradeCountedEcts'], 0)
        self.assertEqual(len(find_duplicate_achievements(courses, 'BSC_INFO_2021')), 1)

    def test_known_number_annotation_alias_collapses_but_not_unrelated_topics(self) -> None:
        old = {'id': 'old', 'courseNumber': 'BIOINF4331', 'ects': 6, 'grade': 1.7}
        new = {'id': 'new', 'courseNumber': 'BIOINF4331 (entspricht BIO-4331)', 'ects': 6, 'grade': 1.7}
        self.assertEqual(achievement_identity(old, 'MSC_INFO_2021'),
                         achievement_identity(new, 'MSC_INFO_2021'))
        self.assertNotEqual(achievement_identity(old, 'MSC_INFO_2021'),
                            achievement_identity({'id': 'other', 'courseNumber': 'BIOINF4332'}, 'MSC_INFO_2021'))

    def test_master_area_and_eligibility_limits_are_source_backed(self) -> None:
        info = get_official_regulation('MSC_INFO_2021')
        ml = get_official_regulation('MSC_ML_2021')
        assert info is not None and ml is not None
        self.assertEqual(info['maxSeminars'], 3)
        self.assertEqual(info['alternativeAreas'], [['INFO-FOKUS', 'INFO-BASIS']])
        self.assertEqual(info['conditionalAreas'], ['INFO-BASIS'])
        self.assertEqual(info['masterOnlyAreas'], ['INFO-PRAK', 'INFO-TECH', 'INFO-THEO', 'INFO-INFO', 'INFO-FOKUS'])
        self.assertEqual(info['areaLimits']['INFO-INFO']['maxResearchProjects'], 1)
        self.assertEqual(ml['maxSeminars'], 3)
        self.assertEqual(ml['areaLimits']['ML-DIVERSE'], {'maxSeminarEcts': 6, 'maxPracticalEcts': 6})
        self.assertEqual(ml['bachelorElectiveOnlyAreas'], ['ML-CS'])
        self.assertEqual(ml['gradeExcludedAreas'], ['ML-EXP'])
        self.assertTrue(ml['gradedModulesOnly'])

    def test_parent_module_components_have_separate_assessment_identity_and_budget(self) -> None:
        parts = [
            {'id': f'part-{index}', 'moduleCode': 'BIOINFM1240', 'courseNumber': 'BIOINFM1240',
             'title': f'Zellbiologie Teil {index}', 'ects': 4, 'grade': 1.3 + index / 10,
             'studyAreaCode': 'LIFE', 'allowedAreaCodes': ['LIFE']}
            for index in range(1, 4)
        ]
        result = compute_credit_accounting('BSC_BIOINFO_2021', parts)
        self.assertEqual(result['uniqueEarnedEcts'], 12)
        self.assertEqual(result['degreeCountedEcts'], 12)
        self.assertNotIn('BIOINFM1240', result['missingRequiredModules'])

    def test_thesis_written_and_oral_components_are_distinct_and_full_thesis_is_not_double_counted(self) -> None:
        written = {'id': 'written', 'moduleCode': 'INFM3999', 'courseNumber': 'THESIS-WRITTEN',
                   'title': 'Bachelorarbeit', 'ects': 12, 'grade': 1.7, 'studyAreaCode': 'THESIS',
                   'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'written'}}
        oral = {'id': 'oral', 'moduleCode': 'INFM3999', 'courseNumber': 'THESIS-ORAL',
                'title': 'Bachelor-Kolloquium', 'ects': 3, 'grade': 2.3, 'studyAreaCode': 'THESIS',
                'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'oral'}}
        split = compute_credit_accounting('BSC_INFO_2021', [written, oral])
        self.assertEqual(split['degreeCountedEcts'], 15)
        self.assertEqual(split['gradeCountedEcts'], 15)
        self.assertNotIn('INFM3999', split['missingRequiredModules'])
        duplicate_written = compute_credit_accounting('BSC_INFO_2021', [
            written, {**written, 'id': 'duplicate'},
        ])
        self.assertEqual(duplicate_written['uniqueEarnedEcts'], 12)
        self.assertEqual(duplicate_written['degreeCountedEcts'], 12)
        full = {'id': 'full', 'moduleCode': 'INFM3999', 'courseNumber': 'INFM3999',
                'title': 'Abschlussmodul', 'ects': 15, 'grade': 1.7, 'studyAreaCode': 'THESIS'}
        whole_plus_oral = compute_credit_accounting('BSC_INFO_2021', [full, oral])
        self.assertEqual(whole_plus_oral['uniqueEarnedEcts'], 15)
        self.assertEqual(whole_plus_oral['degreeCountedEcts'], 15)
        self.assertIn('completion_component_already_included',
                      whole_plus_oral['courseAccounting']['oral']['reviewReasons'])

    def test_required_choice_and_area_slots_need_sufficient_accepted_credits(self) -> None:
        missing_math_iv = compute_credit_accounting('BSC_INFO_2021', [])
        self.assertIn('INFM2020', missing_math_iv['missingRequiredModules'])
        self.assertIn('INF', missing_math_iv['missingRequiredAreas'])
        both_math_iv_alternatives = compute_credit_accounting('BSC_INFO_2021', [
            {'id': 'numerik', 'courseNumber': 'MAT-95-41', 'ects': 6, 'grade': 1.7, 'studyAreaCode': 'INF'},
            {'id': 'stochastik', 'courseNumber': 'MAT-95-42', 'ects': 6, 'grade': 2.3, 'studyAreaCode': 'INF'},
        ])
        self.assertEqual(both_math_iv_alternatives['uniqueEarnedEcts'], 12)
        self.assertEqual(both_math_iv_alternatives['degreeCountedEcts'], 6)
        self.assertNotIn('INFM2020', both_math_iv_alternatives['missingRequiredModules'])
        short_required = compute_credit_accounting('BSC_MEDIENINFO_2021', [
            {'id': 'math-three', 'courseNumber': 'INFM2010', 'ects': 6, 'grade': 1.7,
             'studyAreaCode': 'MATH'},
        ])
        self.assertIn('INFM2010', short_required['missingRequiredModules'])
        self.assertEqual(short_required['courseAccounting']['math-three']['degreeCountedEcts'], 0)
        self.assertIn('required_module_incomplete',
                      short_required['courseAccounting']['math-three']['reviewReasons'])
        rejected_numerik = compute_credit_accounting('BSC_BIOINFO_2021', [
            {'id': 'wrong-math', 'courseNumber': 'MAT-95-41', 'ects': 6, 'grade': 1.7,
             'studyAreaCode': 'MATH'},
        ])
        self.assertEqual(rejected_numerik['degreeCountedEcts'], 0)
        self.assertIn('BIOINFM2021', rejected_numerik['missingRequiredModules'])
        self.assertIn('compulsory_module_unverified',
                      rejected_numerik['courseAccounting']['wrong-math']['reviewReasons'])

    def test_master_read_time_seminar_caps_preserve_excess_and_report_reviews(self) -> None:
        info = [
            {'id': f'info-{n}', 'courseNumber': f'INFO-SEM-{n}', 'title': f'Seminar {n}',
             'courseType': 'Seminar', 'ects': 3, 'grade': 1.7, 'studyAreaCode': 'INFO-INFO',
             'allowedAreaCodes': ['INFO-INFO']}
            for n in range(4)
        ]
        info_result = compute_credit_accounting('MSC_INFO_2021', info)
        self.assertEqual(info_result['recordedEcts'], 12)
        self.assertEqual(info_result['degreeCountedEcts'], 9)
        self.assertEqual([key for key, row in info_result['courseAccounting'].items()
                          if 'seminar_count_limit_exceeded' in row['reviewReasons']], ['info-3'])
        ml = [{**row, 'id': f'ml-{n}', 'courseNumber': f'ML-SEM-{n}',
               'studyAreaCode': 'ML-DIVERSE', 'allowedAreaCodes': ['ML-DIVERSE']}
              for n, row in enumerate(info[:3])]
        ml_result = compute_credit_accounting('MSC_ML_2021', ml)
        self.assertEqual(ml_result['recordedEcts'], 9)
        self.assertEqual(ml_result['degreeCountedEcts'], 6)
        self.assertEqual([key for key, row in ml_result['courseAccounting'].items()
                          if 'seminar_area_limit_exceeded' in row['reviewReasons']], ['ml-2'])

    def test_unknown_restricted_master_course_needs_source_eligibility_or_recognition(self) -> None:
        course = {'id': 'unknown', 'courseNumber': 'UNKNOWN-MASTER', 'ects': 6, 'grade': 1.7,
                  'studyAreaCode': 'ML-CS'}
        result = compute_credit_accounting('MSC_ML_2021', [course])
        self.assertEqual(result['degreeCountedEcts'], 0)
        self.assertIn('course_eligibility_unverified', result['courseAccounting']['unknown']['reviewReasons'])
        recognized = compute_credit_accounting('MSC_ML_2021', [{
            **course, 'recognitionEvidence': {
                'confirmed': True, 'areaCode': 'ML-CS', 'componentKind': 'whole',
            },
        }])
        self.assertEqual(recognized['degreeCountedEcts'], 6)

    def test_info_basis_requires_explicit_declaration_and_excludes_focus_when_declared(self) -> None:
        course = {'id': 'basis', 'courseNumber': 'ELECTIVE-A', 'ects': 9, 'grade': 1.3,
                  'studyAreaCode': 'INFO-BASIS', 'allowedAreaCodes': ['INFO-BASIS']}
        default_result = compute_credit_accounting('MSC_INFO_2021', [course])
        confirmed_result = compute_credit_accounting(
            'MSC_INFO_2021', [course], {'mscInfoBasisAdmissionConfirmed': True},
        )
        self.assertEqual(default_result['courseAccounting']['basis']['degreeCountedEcts'], 0)
        self.assertIn('basis_area_requires_admission_declaration',
                      default_result['courseAccounting']['basis']['reviewReasons'])
        self.assertEqual(confirmed_result['courseAccounting']['basis']['degreeCountedEcts'], 9)
        focus_course = {**course, 'id': 'focus', 'studyAreaCode': 'INFO-FOKUS'}
        focus_result = compute_credit_accounting(
            'MSC_INFO_2021', [focus_course], {'mscInfoBasisAdmissionConfirmed': True},
        )
        self.assertEqual(focus_result['courseAccounting']['focus']['degreeCountedEcts'], 0)
        self.assertIn('focus_area_excluded_by_basis_admission',
                      focus_result['courseAccounting']['focus']['reviewReasons'])

    def test_seminar_project_practical_limits_use_typed_course_evidence(self) -> None:
        seminars = [
            {'areaCode': 'INFO-INFO', 'ects': 3, 'assessmentType': assessment_type('Seminar')}
            for _ in range(4)
        ]
        self.assertEqual(assignment_limit_error('MSC_INFO_2021', seminars), 'maximum_seminars_exceeded')
        self.assertIsNone(assignment_limit_error('MSC_INFO_2021', seminars[:3]))
        diverse = [
            {'areaCode': 'ML-DIVERSE', 'ects': 3, 'assessmentType': 'seminar'}
            for _ in range(3)
        ]
        self.assertEqual(assignment_limit_error('MSC_ML_2021', diverse), 'area_seminar_ects_exceeded')
        practicals = [
            {'areaCode': 'ML-DIVERSE', 'ects': 3, 'assessmentType': 'practical'}
            for _ in range(3)
        ]
        self.assertEqual(assignment_limit_error('MSC_ML_2021', practicals), 'area_practical_ects_exceeded')
        projects = [
            {'areaCode': 'INFO-INFO', 'ects': 9, 'assessmentType': 'research_project'}
            for _ in range(2)
        ]
        self.assertEqual(assignment_limit_error('MSC_INFO_2021', projects), 'area_research_projects_exceeded')

    def test_exp_grades_excluded_but_all_other_graded_modules_including_uebk_count(self) -> None:
        self.assertFalse(grade_is_counted('MSC_ML_2021', 'ML-EXP'))
        self.assertTrue(grade_is_counted('MSC_ML_2021', 'ML-CS'))
        self.assertTrue(grade_is_counted('BSC_INFO_2021', 'UEBK'))
        result = compute_credit_accounting('MSC_ML_2021', [
            {'id': 'graded', 'courseNumber': 'UNKNOWN', 'ects': 6, 'grade': 1.0, 'studyAreaCode': 'ML-CS', 'allowedAreaCodes': ['ML-CS']},
            {'id': 'exp', 'courseNumber': 'SPORT', 'ects': 6, 'grade': 4.0, 'studyAreaCode': 'ML-EXP', 'allowedAreaCodes': ['ML-EXP']},
        ])
        self.assertEqual(result['recordedEcts'], 12)
        self.assertEqual(result['degreeCountedEcts'], 12)
        self.assertEqual(result['gradeCountedEcts'], 6)
        self.assertEqual(result['degreeGrade'], 1.0)

    def test_official_decimal_is_truncated_not_rounded(self) -> None:
        self.assertEqual(truncate_official_grade(1.99), 1.9)
        self.assertEqual(truncate_official_grade(2.05), 2.0)
        self.assertEqual(get_official_regulation('BSC_INFO_2021')['moduleGradeDecimals'], 2)
        self.assertEqual(get_official_regulation('BSC_INFO_2021')['degreeGradeDecimals'], 1)

    def test_module_grade_decimals_and_explicit_external_assessment_type(self) -> None:
        self.assertEqual(_normalize_grade(1.66), 1.66)
        self.assertEqual(_normalize_grade(4.0), 4.0)
        for invalid in (0.99, 4.01, 1.666, float('nan'), float('inf')):
            with self.subTest(invalid=invalid), self.assertRaises(CompletedCourseUpdateError):
                _normalize_grade(invalid)
        base = {'title': 'External Course', 'semester': 'WS 2025/26', 'masterCat': 'INFO',
                'ects': 6, 'studyAreaCode': 'ML-CS'}
        with self.assertRaisesRegex(CompletedCourseUpdateError, 'assessmentType'):
            _normalize_completed_course(base, 'MSC_ML_2021')
        normalized = _normalize_completed_course({**base, 'assessmentType': 'seminar'}, 'MSC_ML_2021')
        self.assertEqual(normalized['assessmentType'], 'seminar')

    def test_component_module_average_is_two_decimals_and_row_totals_reconcile(self) -> None:
        rows = [
            {'id': f'part-{index}', 'moduleCode': 'BIOINFM1240', 'courseNumber': f'PART-{index}',
             'title': f'Cell Biology part {index}', 'ects': 4, 'grade': grade,
             'studyAreaCode': 'LIFE', 'allowedAreaCodes': ['LIFE']}
            for index, grade in enumerate((1.67, 1.66, 1.66))
        ]
        result = compute_credit_accounting('BSC_BIOINFO_2021', rows)
        self.assertEqual(result['degreeCountedEcts'], 12)
        self.assertEqual(result['gradeCountedEcts'], 12)
        self.assertEqual([row['gradeUsedForAverage'] for row in result['courseAccounting'].values()],
                         [1.66, 1.66, 1.66])
        for total, row_key in (('uniqueEarnedEcts', 'uniqueEarnedEcts'),
                               ('degreeCountedEcts', 'degreeCountedEcts'),
                               ('gradeCountedEcts', 'gradeCountedEcts')):
            self.assertEqual(result[total], sum(row[row_key] for row in result['courseAccounting'].values()))

    def test_additional_achievement_is_retained_but_not_degree_counted(self) -> None:
        course = {'id': 'additional', 'courseNumber': 'EXTERNAL-1', 'ects': 6, 'grade': 1.7,
                  'studyAreaCode': 'ML-CS', 'allowedAreaCodes': ['ML-CS'],
                  'isAdditionalAchievement': True}
        result = compute_credit_accounting('MSC_ML_2021', [course])
        self.assertEqual(result['uniqueEarnedEcts'], 6)
        self.assertEqual(result['additionalEcts'], 6)
        self.assertEqual(result['degreeCountedEcts'], 0)

    def test_explicit_unknown_master_assessment_type_applies_semester_cap(self) -> None:
        courses = [
            {'id': f'unknown-{index}', 'courseNumber': f'EXTERNAL-{index}', 'ects': 3,
             'assessmentType': 'seminar', 'studyAreaCode': 'INFO-INFO',
             'recognitionEvidence': {'confirmed': True, 'areaCode': 'INFO-INFO', 'componentKind': 'whole'}}
            for index in range(4)
        ]
        result = compute_credit_accounting('MSC_INFO_2021', courses)
        self.assertEqual(result['degreeCountedEcts'], 9)
        self.assertIn('seminar_count_limit_exceeded', result['courseAccounting']['unknown-3']['reviewReasons'])

    def test_confirmed_recognition_requires_module_area_consistency(self) -> None:
        with self.assertRaisesRegex(CompletedCourseUpdateError, 'same PO module'):
            _normalize_completed_course({
                'title': 'Recognized', 'semester': 'WS 2025/26', 'masterCat': 'INFO', 'ects': 9,
                'studyAreaCode': 'INF', 'recognitionEvidence': {
                    'confirmed': True, 'moduleCode': 'INFM1010', 'areaCode': 'PRAK',
                },
            }, 'BSC_INFO_2021')

    def test_thesis_module_does_not_inflate_written_component_to_whole_completion(self) -> None:
        policy = get_official_regulation('BSC_INFO_2021')
        assert policy is not None
        thesis = next(module for module in policy['modules'] if module['code'] == 'INFM3999')
        self.assertEqual(thesis['ects'], 15)
        self.assertEqual(policy['writtenThesisEcts'], 12)
        self.assertEqual(policy['oralThesisEcts'], 3)
        course = {'id': 'thesis', 'moduleCode': 'INFM3999', 'title': 'Bachelorarbeit', 'ects': 12,
                  'grade': 1.0, 'studyAreaCode': 'THESIS',
                  'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'written'}}
        result = compute_credit_accounting('BSC_INFO_2021', [course])
        self.assertEqual(result['degreeCountedEcts'], 12)

    def test_dynamic_source_module_metadata_dedupes_full_alias_offerings_and_budgets_parts(self) -> None:
        def metadata(budget: int) -> dict[str, object]:
            return {'programs': [{'programCode': 'MSC_INFO_2021', 'modules': [{
                'moduleCode': 'M_INF_12345', 'moduleTitle': 'Dynamic module', 'moduleKind': 'module',
                'moduleBudgetEcts': budget, 'areaCode': 'INFO-INFO',
            }]}]}

        shared = metadata(6)
        lecture = {'id': 'vl', 'courseNumber': 'M_INF_12345-VL', 'moduleCode': 'M_INF_12345',
                   'title': 'Dynamic module lecture', 'courseType': 'Vorlesung', 'ects': 6, 'grade': 1.7,
                   'studyAreaCode': 'INFO-INFO', 'allowedAreaCodes': ['INFO-INFO'], 'creditMetadata': shared}
        tutorial = {**lecture, 'id': 'ue', 'courseNumber': 'M_INF_12345-UE',
                    'title': 'Dynamic module tutorial', 'courseType': 'Übung'}
        aliases = compute_credit_accounting('MSC_INFO_2021', [lecture, tutorial])
        self.assertEqual(aliases['uniqueEarnedEcts'], 6)
        self.assertEqual(aliases['degreeCountedEcts'], 6)
        self.assertIn('duplicate_achievement', aliases['courseAccounting']['ue']['reviewReasons'])

        parts = [
            {'id': f'part-{index}', 'courseNumber': f'M_INF_12345-P{index}',
             'moduleCode': 'M_INF_12345', 'title': f'Part {index}', 'ects': 4, 'grade': 1.7,
             'studyAreaCode': 'INFO-INFO', 'allowedAreaCodes': ['INFO-INFO'],
             'componentKey': f'part-{index}', 'creditMetadata': metadata(12)}
            for index in range(3)
        ]
        result = compute_credit_accounting('MSC_INFO_2021', parts)
        self.assertEqual(result['uniqueEarnedEcts'], 12)
        self.assertEqual(result['degreeCountedEcts'], 12)

    def test_proseminar_identity_is_stable_when_recognized_into_elective_pool(self) -> None:
        metadata = {'programs': [{'programCode': 'BSC_INFO_2021', 'modules': [{
            'moduleCode': 'INFM1510', 'moduleTitle': 'Proseminar Informatik',
            'moduleKind': 'module', 'moduleBudgetEcts': 3, 'areaCode': 'INF',
        }]}]}
        original = {
            'id': 'required-slot', 'courseNumber': 'PROSEM-AI-01', 'moduleCode': 'INFM1510',
            'title': 'Proseminar: AI Fairness', 'courseType': 'Seminar', 'assessmentComponent': 'AI Fairness',
            'ects': 3, 'grade': 1.7, 'studyAreaCode': 'INF', 'allowedAreaCodes': ['INF'],
            'creditMetadata': metadata,
        }
        recognized = {
            **original, 'id': 'elective-recognition', 'courseNumber': 'PROSEM-AI-ALIAS',
            'moduleCode': 'INFM2510', 'studyAreaCode': 'INFO', 'allowedAreaCodes': ['INFO'],
            'recognitionEvidence': {'confirmed': True, 'areaCode': 'INFO'},
        }
        self.assertEqual(achievement_identity(original, 'BSC_INFO_2021'),
                         achievement_identity(recognized, 'BSC_INFO_2021'))
        accounting = compute_credit_accounting('BSC_INFO_2021', [original, recognized])
        self.assertEqual(accounting['uniqueEarnedEcts'], 3)
        self.assertEqual(accounting['degreeCountedEcts'], 3)
        self.assertIn('duplicate_achievement', accounting['courseAccounting']['elective-recognition']['reviewReasons'])

    def test_dynamic_lecture_tutorial_whole_precedes_parts_and_ungraded_parts_keep_module_credit(self) -> None:
        metadata = {'programs': [{'programCode': 'MSC_ML_2021', 'modules': [{
            'moduleCode': 'DYNAMIC-MASTER-12', 'moduleKind': 'lecture_tutorial',
            'moduleBudgetEcts': 12, 'moduleEcts': 12, 'areaCode': 'ML-EXP', 'moduleLevel': 'master',
        }]}]}
        whole = {
            'id': 'whole', 'courseNumber': 'DYNAMIC-MASTER-12', 'moduleCode': 'DYNAMIC-MASTER-12',
            'title': 'Dynamic master lecture', 'courseType': 'Vorlesung', 'ects': 12, 'grade': 1.7,
            'studyAreaCode': 'ML-EXP', 'allowedAreaCodes': ['ML-EXP'], 'creditMetadata': metadata,
        }
        parts = [
            {'id': f'part-{index}', 'courseNumber': f'DYNAMIC-MASTER-12-P{index}',
             'moduleCode': 'DYNAMIC-MASTER-12', 'componentKey': f'local-part-{index}',
             'title': f'Dynamic master component {index}', 'courseType': 'Vorlesung', 'ects': 4,
             'grade': 1.7, 'studyAreaCode': 'ML-EXP', 'allowedAreaCodes': ['ML-EXP'],
             'creditMetadata': metadata}
            for index in range(1, 4)
        ]
        full_and_parts = compute_credit_accounting('MSC_ML_2021', [whole, *parts])
        self.assertEqual(full_and_parts['recordedEcts'], 24)
        self.assertEqual(full_and_parts['uniqueEarnedEcts'], 12)
        self.assertEqual(full_and_parts['degreeCountedEcts'], 12)
        self.assertEqual(whole['grade'], 1.7)
        self.assertTrue(all(full_and_parts['courseAccounting'][part['id']]['uniqueEarnedEcts'] == 0 for part in parts))

        graded_parts = [
            {**parts[index - 1], 'id': f'graded-part-{index}', 'courseNumber': f'GRADED-PART-{index}',
             'componentKey': f'graded-part-{index}', 'grade': grade}
            for index, grade in enumerate((1.3, 1.7, None), start=1)
        ]
        split_module = compute_credit_accounting('MSC_ML_2021', graded_parts)
        self.assertEqual(split_module['recordedEcts'], 12)
        self.assertEqual(split_module['uniqueEarnedEcts'], 12)
        self.assertEqual(split_module['degreeCountedEcts'], 12)
        self.assertEqual(split_module['gradeCountedEcts'], 0)
        self.assertIsNone(split_module['degreeGrade'])
        self.assertTrue(all('module_grade_incomplete' in split_module['courseAccounting'][part['id']]['reviewReasons']
                            for part in graded_parts))

    def test_static_proseminar_budget_remains_three_ects(self) -> None:
        courses = [
            {'id': f'sem-{index}', 'courseNumber': f'PROSEM-{index}', 'moduleCode': 'INFM1510',
             'title': f'Proseminar topic {index}', 'courseType': 'Seminar', 'ects': 3, 'grade': 1.7,
             'studyAreaCode': 'INF', 'allowedAreaCodes': ['INF']}
            for index in range(2)
        ]
        result = compute_credit_accounting('BSC_INFO_2021', courses)
        self.assertEqual(result['uniqueEarnedEcts'], 6)
        self.assertEqual(result['degreeCountedEcts'], 3)
        self.assertIn('module_credit_limit_exceeded', result['courseAccounting']['sem-1']['reviewReasons'])

    def test_area_overflow_is_held_whole_for_review_unless_board_allocation_is_explicit(self) -> None:
        courses = [
            {'id': 'one', 'courseNumber': 'INFO-ONE', 'ects': 14, 'grade': 1.5,
             'studyAreaCode': 'INFO-INFO', 'allowedAreaCodes': ['INFO-INFO']},
            {'id': 'two', 'courseNumber': 'INFO-TWO', 'ects': 9, 'grade': 2.0,
             'studyAreaCode': 'INFO-INFO', 'allowedAreaCodes': ['INFO-INFO']},
        ]
        overflow = compute_credit_accounting('MSC_INFO_2021', courses)
        self.assertEqual(overflow['recordedEcts'], 23)
        self.assertEqual(overflow['uniqueEarnedEcts'], 23)
        self.assertEqual(overflow['degreeCountedEcts'], 14)
        self.assertEqual(overflow['courseAccounting']['two']['degreeCountedEcts'], 0)
        self.assertIn('area_credit_limit_exceeded', overflow['courseAccounting']['two']['reviewReasons'])
        approved = compute_credit_accounting('MSC_INFO_2021', [{
            **courses[0], 'ects': 14,
        }, {
            **courses[1], 'recognitionEvidence': {
                'confirmed': True, 'areaCode': 'INFO-INFO', 'countedEcts': 4,
            },
        }])
        self.assertEqual(approved['uniqueEarnedEcts'], 23)
        self.assertEqual(approved['degreeCountedEcts'], 18)
        self.assertEqual(approved['gradeCountedEcts'], 18)
        self.assertEqual(approved['courseAccounting']['two']['earnedEcts'], 9)
        self.assertEqual(approved['courseAccounting']['two']['degreeCountedEcts'], 4)
        self.assertEqual(approved['degreeCountedEcts'], sum(
            row['degreeCountedEcts'] for row in approved['courseAccounting'].values()))
        self.assertEqual(approved['gradeCountedEcts'], sum(
            row['gradeCountedEcts'] for row in approved['courseAccounting'].values()))

    def test_explicit_recognition_component_identity_does_not_require_static_module(self) -> None:
        first = {'courseNumber': 'EXTERNAL-1', 'ects': 3, 'studyAreaCode': 'INFO-INFO',
                 'recognitionEvidence': {'confirmed': True, 'areaCode': 'INFO-INFO',
                                         'componentKey': 'written-part'}}
        second = {**first, 'courseNumber': 'EXTERNAL-2',
                  'recognitionEvidence': {**first['recognitionEvidence'], 'componentKey': 'oral-part'}}
        self.assertNotEqual(achievement_identity(first, 'MSC_INFO_2021'),
                            achievement_identity(second, 'MSC_INFO_2021'))

    def test_board_allocation_validation_bounds_and_thesis_non_partial_rule(self) -> None:
        base = {'title': 'External course', 'semester': 'WS 2025/26', 'masterCat': 'INFO',
                'ects': 9, 'studyAreaCode': 'INFO-INFO', 'assessmentType': 'lecture', 'recognitionEvidence': {
                    'confirmed': True, 'areaCode': 'INFO-INFO', 'countedEcts': 4,
                }}
        self.assertEqual(_normalize_completed_course(base, 'MSC_INFO_2021')['recognitionEvidence']['countedEcts'], 4)
        for amount in (10, -1, float('nan')):
            payload = {**base, 'recognitionEvidence': {**base['recognitionEvidence'], 'countedEcts': amount}}
            with self.subTest(amount=amount), self.assertRaisesRegex(CompletedCourseUpdateError, 'countedEcts'):
                _normalize_completed_course(payload, 'MSC_INFO_2021')
        thesis = {**base, 'studyAreaCode': 'THESIS', 'recognitionEvidence': {
            'confirmed': True, 'areaCode': 'THESIS', 'countedEcts': 4,
        }}
        with self.assertRaisesRegex(CompletedCourseUpdateError, 'thesis credit cannot be partial'):
            _normalize_completed_course(thesis, 'MSC_INFO_2021')

    def test_opaque_thesis_components_do_not_substitute_for_formal_written_oral_split(self) -> None:
        rows = [
            {'id': f'part-{index}', 'courseNumber': f'THESIS-P{index}', 'title': f'Project {index}',
             'ects': 15, 'grade': 1.7, 'studyAreaCode': 'THESIS',
             'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS',
                                     'componentKind': 'component', 'componentKey': f'part-{index}'}}
            for index in range(2)
        ]
        rejected = compute_credit_accounting('MSC_INFO_2021', rows)
        self.assertEqual(rejected['degreeCountedEcts'], 0)
        self.assertTrue(all('completion_component_kind_unverified' in row['reviewReasons']
                            for row in rejected['courseAccounting'].values()))
        whole = compute_credit_accounting('MSC_INFO_2021', [{
            'id': 'whole', 'courseNumber': 'THESIS', 'title': 'Masterarbeit', 'ects': 30,
            'grade': 1.3, 'studyAreaCode': 'THESIS',
            'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'whole'},
        }])
        self.assertEqual(whole['degreeCountedEcts'], 30)
        msc_split = compute_credit_accounting('MSC_INFO_2021', [
            {'id': 'written', 'courseNumber': 'MASTER-WRITTEN', 'ects': 27, 'grade': 1.7,
             'studyAreaCode': 'THESIS', 'recognitionEvidence': {
                 'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'written'}},
            {'id': 'oral', 'courseNumber': 'MASTER-ORAL', 'ects': 3, 'grade': 1.3,
             'studyAreaCode': 'THESIS', 'recognitionEvidence': {
                 'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'oral'}},
        ])
        self.assertEqual(msc_split['degreeCountedEcts'], 30)
        bsc_split = compute_credit_accounting('BSC_INFO_2021', [
            {'id': 'written', 'courseNumber': 'BACHELOR-WRITTEN', 'ects': 12, 'grade': 1.7,
             'studyAreaCode': 'THESIS', 'recognitionEvidence': {
                 'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'written'}},
            {'id': 'oral', 'courseNumber': 'BACHELOR-ORAL', 'ects': 3, 'grade': 1.3,
             'studyAreaCode': 'THESIS', 'recognitionEvidence': {
                 'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'oral'}},
        ])
        self.assertEqual(bsc_split['degreeCountedEcts'], 15)
        bsc_whole = compute_credit_accounting('BSC_INFO_2021', [{
            'id': 'whole', 'courseNumber': 'THESIS', 'title': 'Bachelorarbeit', 'ects': 15,
            'grade': 1.3, 'studyAreaCode': 'THESIS',
            'recognitionEvidence': {'confirmed': True, 'areaCode': 'THESIS', 'componentKind': 'whole'},
        }])
        self.assertEqual(bsc_whole['degreeCountedEcts'], 15)

    def test_forward_migration_is_data_only_and_does_not_touch_user_records(self) -> None:
        migration = Path(__file__).resolve().parents[1] / 'migrations' / '0040_official_po_credit_policies.sql'
        text = migration.read_text(encoding='utf-8').upper()
        self.assertIn('INSERT INTO CURRICULUM_MODULES', text)
        self.assertIn('INSERT INTO REGULATION_RULE_GROUPS', text)
        self.assertIn('INSERT INTO MODULE_STUDY_AREA_OPTIONS', text)
        for forbidden in ('DROP TABLE', 'ALTER TABLE', 'UPDATE USER_PROGRESS', 'UPDATE USER_STATE'):
            self.assertNotIn(forbidden, text)
        self.assertNotIn('DELETE FROM USER_', text)
        self.assertIn("VALUES ('BIOINFM2510','WAHLPFLICHT INFORMATIK',NULL,'POOL'", text)
        self.assertIn('SELECT CM.ID,SA.ID,NULL', text)


if __name__ == '__main__':
    unittest.main()
