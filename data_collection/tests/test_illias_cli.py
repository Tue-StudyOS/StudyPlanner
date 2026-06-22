from __future__ import annotations

import unittest

from data_collection.illias.cli import _d1_course_id_expression


class IliasCliTests(unittest.TestCase):
    def test_d1_course_id_expression_uses_stable_period_and_number(self) -> None:
        expression = _d1_course_id_expression(
            {"alma_course_id": 1003},
            {
                1003: {
                    "period_id": "229",
                    "number": "ML4201",
                    "unit_id": "26645",
                    "title": "ML4201 Statistical Machine Learning - Vorlesung/Übung",
                }
            },
        )

        self.assertEqual(
            expression,
            "(SELECT id FROM courses WHERE period_id = '229' AND number = 'ML4201' ORDER BY id LIMIT 1)",
        )

    def test_d1_course_id_expression_does_not_emit_stale_numeric_id(self) -> None:
        expression = _d1_course_id_expression({"alma_course_id": 1003}, {})

        self.assertEqual(expression, "NULL")


if __name__ == "__main__":
    unittest.main()
