import sqlite3
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
INITIAL_MIGRATION = ROOT_DIR / 'migrations' / '0001_initial.sql'
CURRICULUM_SEED_MIGRATION = ROOT_DIR / 'migrations' / '0031_seed_legacy_curriculum_modules.sql'


class CurriculumSeedMigrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = sqlite3.connect(':memory:')
        self.connection.create_function('unixepoch', 0, lambda: 0)
        self.connection.executescript(INITIAL_MIGRATION.read_text(encoding='utf-8'))
        self.connection.executescript(
            """
            INSERT INTO study_programs (id, code, name) VALUES
                (1, 'BSC_INFO_2021', 'B.Sc. Informatik'),
                (2, 'MSC_INFO_2021', 'M.Sc. Informatik'),
                (3, 'MSC_ML_2021', 'M.Sc. Machine Learning');
            INSERT INTO study_areas (program_id, code, name) VALUES
                (1, 'MATH', 'Mathematik'), (1, 'INF', 'Informatik'),
                (1, 'INFO', 'Vertiefung'), (1, 'PROSEM', 'Proseminar'),
                (1, 'THEO', 'Theorie'), (2, 'INFO-BASIS', 'Grundlagen'),
                (2, 'INFO-INFO', 'Vertiefung'), (2, 'INFO-THEO', 'Theorie'),
                (3, 'ML-CS', 'General Computer Science');
            """
        )

    def tearDown(self) -> None:
        self.connection.close()

    def test_seed_recreates_the_legacy_modules_with_aliases_and_area_options(self) -> None:
        self.connection.executescript(CURRICULUM_SEED_MIGRATION.read_text(encoding='utf-8'))

        self.assertEqual(
            self.connection.execute('SELECT COUNT(*) FROM curriculum_modules').fetchone()[0],
            12,
        )
        self.assertEqual(
            self.connection.execute('SELECT ects FROM curriculum_modules WHERE module_code = ?', ('INFO4451',)).fetchone()[0],
            9.0,
        )
        self.assertEqual(
            self.connection.execute(
                "SELECT normalized_alias FROM curriculum_module_aliases WHERE alias = 'INF1020-V'"
            ).fetchone()[0],
            'INF1020V',
        )
        self.assertEqual(
            self.connection.execute('SELECT COUNT(*) FROM module_study_area_options').fetchone()[0],
            18,
        )


if __name__ == '__main__':
    unittest.main()
