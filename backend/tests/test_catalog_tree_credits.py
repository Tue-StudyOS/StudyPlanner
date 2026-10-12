import json
import unittest
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))
from services.catalog_tree_credits import get_tree_credit_options, get_unambiguous_tree_credits
from services.course_catalog import _build_catalog_summary


def variant(paths: list[list[str]]) -> dict[str, object]:
    return {'id': 1, 'catalogTreePathsJson': json.dumps(paths)}


class CatalogTreeCreditsTest(unittest.TestCase):
    def test_program_values_remain_distinct(self) -> None:
        options = get_tree_credit_options([variant([
            ['MScInfo-INFO-PRAK-21-VG1 Practical Informatics (9 CP)', 'ML4370 LLM Engineering'],
            ['BSc-BIOINFM2510-21-VG1 Bioinformatics (6 CP)', 'ML4370 LLM Engineering'],
        ])])
        self.assertEqual([(row['programCode'], row['ects']) for row in options], [('BSC_BIOINFO_2021', 6), ('MSC_INFO_2021', 9)])
        self.assertIsNone(get_unambiguous_tree_credits(options))
        self.assertIn('9 CP', options[1]['sourceLabels'][0])

    def test_area_totals_and_colloquia_do_not_provide_course_credits(self) -> None:
        self.assertEqual(get_tree_credit_options([variant([
            ['INFO-PRAK Practical Informatics (30 CP)', 'Algorithms in Bioinformatics'],
            ['VVZ-INF Kolloquien', 'Algorithms in Bioinformatics'],
        ])]), [])

    def test_nearest_group_wins_and_duplicates_are_merged(self) -> None:
        path = ['MScInfo-INFO-INFO-21-VG1 Outer (9 CP)', 'MScInfo-INFO-INFO-21-VG2 Inner (6 CP)', 'Course']
        options = get_tree_credit_options([variant([path, path])])
        self.assertEqual(len(options), 1)
        self.assertEqual(get_unambiguous_tree_credits(options), 6)
        self.assertEqual(len(options[0]['sourceLabels']), 1)

    def test_conflicts_within_one_program_are_preserved(self) -> None:
        options = get_tree_credit_options([variant([
            ['MScInfo-INFO-INFO-21-VG1 Group (6 CP)', 'Course'],
            ['MScInfo-INFO-PRAK-21-VG1 Group (9 CP)', 'Course'],
        ])])
        self.assertIsNone(get_unambiguous_tree_credits(options))

    def test_other_regulations_and_unknown_programs_are_not_guessed(self) -> None:
        self.assertEqual(get_tree_credit_options([variant([
            ['MScInfo-INFO-INFO-20-VG1 Group (6 CP)', 'Course'],
            ['OtherProgram-21-VG1 Group (9 CP)', 'Course'],
        ])]), [])

    def test_explicit_module_and_short_comment_credits_take_priority(self) -> None:
        course = variant([['MScInfo-INFO-INFO-21-VG1 Group (9 CP)', 'Course']])
        summary = _build_catalog_summary(course, [], [], [], [{'moduleEcts': 6}])
        self.assertEqual(summary['ects'], 6)
        self.assertEqual(summary['ectsTreeOptions'], [])
        course['shortComment'] = '3 CP'
        self.assertEqual(_build_catalog_summary(course, [], [], [], [])['ects'], 3)

    def test_summary_falls_back_only_when_unambiguous(self) -> None:
        course = variant([['MScInfo-INFO-INFO-21-VG1 Group (6 CP)', 'Course']])
        summary = _build_catalog_summary(course, [], [], [], [])
        self.assertEqual(summary['ects'], 6)
        self.assertEqual(summary['ectsSource'], 'catalog_tree')

    def test_invalid_path_data_is_not_silently_ignored(self) -> None:
        with self.assertRaises(ValueError):
            get_tree_credit_options([{'catalogTreePathsJson': '{}'}])
