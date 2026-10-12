import copy
import unittest

from backend.scripts.import_alma_json_to_d1 import (
    build_seed_plan,
    extract_weekday,
    parse_cancellation_dates,
    plan_course_signatures,
)
from backend.tests.test_import_alma_json_to_d1 import IncrementalImportTest, _alma_course


class ScheduleParsingTest(unittest.TestCase):
    def test_current_and_legacy_weekdays(self) -> None:
        for value in ("Di", "Di.", "Dienstag", "Di. w\u00f6chentlich"):
            with self.subTest(value=value):
                self.assertEqual(extract_weekday(value)[1], 1)

    def test_cancellations_are_sorted_and_deduplicated(self) -> None:
        self.assertEqual(
            parse_cancellation_dates("05.01.2027 29.12.2026 05.01.2027", "2026-10-13", "2027-02-02"),
            ["2026-12-29", "2027-01-05"],
        )

    def test_invalid_cancellations_fail_explicitly(self) -> None:
        for value in ("31.02.2027", "unknown", "29.12.2026 extra"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                parse_cancellation_dates(value, "2026-10-13", "2027-02-02")

    def test_semester_cancellations_outside_shorter_series_are_reported_and_ignored(self) -> None:
        with self.assertWarnsRegex(RuntimeWarning, 'outside'):
            dates = parse_cancellation_dates(
                '24.12.2026 31.12.2026 04.02.2027', '2026-10-15', '2027-01-28',
            )
        self.assertEqual(dates, ['2026-12-24', '2026-12-31'])

    def test_cancellations_require_a_published_range(self) -> None:
        with self.assertRaises(ValueError):
            parse_cancellation_dates("29.12.2026", None, None)

    def test_cancellations_must_match_weekday(self) -> None:
        course = _alma_course("237", "u9", "INFO4900", "Prof. New")
        course["details"]["parallel_groups"][0]["appointments"][0].update({
            "Wochentag": "Mo", "Startdatum - Enddatum": "13.10.2026 - 02.02.2027",
            "Ausfalltermin": "29.12.2026",
        })
        with self.assertRaises(ValueError):
            build_seed_plan({"courses": [course]})


class ScheduleRefreshTest(IncrementalImportTest):
    def test_inserted_and_reordered_meetings_keep_saved_appointment_ids(self) -> None:
        course = _alma_course("237", "u9", "INFO4900", "Prof. New")
        group = course["details"]["parallel_groups"][0]
        first = {"Rhythmus": "Mo. w\u00f6chentlich", "Von - Bis": "10:00 - 12:00", "Raum": "A"}
        second = {"Rhythmus": "Mi. w\u00f6chentlich", "Von - Bis": "14:00 - 16:00", "Raum": "B"}
        group["appointments"] = [first, second]
        before, problems = self._import_incrementally([course])
        self.assertEqual(problems, [])
        self._save_plan_hiding_first_appointment_of("u9")
        inserted = {"Rhythmus": "Di. w\u00f6chentlich", "Von - Bis": "08:00 - 10:00", "Raum": "C"}
        group["appointments"] = [inserted, second, first]
        after, problems = self._import_incrementally([course])
        self.assertEqual(problems, [])
        self.assertGreater(after.appointments[0]["id"], max(row["id"] for row in before.appointments))
        self.assertEqual(after.appointments[1]["id"], before.appointments[1]["id"])
        self.assertEqual(after.appointments[2]["id"], before.appointments[0]["id"])
        self.assertEqual(
            self._query(f"SELECT room_text FROM appointments WHERE id={before.appointments[0]['id']}"),
            [{"room_text": "A"}],
        )

    def test_refresh_preserves_ids_and_replaces_only_target_cancellations(self) -> None:
        course = _alma_course("237", "u9", "INFO4900", "Prof. New")
        appointment = course["details"]["parallel_groups"][0]["appointments"][0]
        appointment.update({"Rhythmus": "w\u00f6chentlich", "Wochentag": "Di", "Startdatum - Enddatum": "13.10.2026 - 02.02.2027", "Ausfalltermin": "29.12.2026 05.01.2027"})
        first, problems = self._import_incrementally([course])
        self.assertEqual(problems, [])
        self._save_plan_hiding_first_appointment_of("u9")
        other_id = self._query("SELECT id FROM appointments WHERE id != " + str(first.appointments[0]["id"]))[0]["id"]
        self.conn.execute("INSERT INTO appointment_cancellations VALUES (?, ?)", (other_id, "2025-12-22"))
        self.conn.commit()
        changed = copy.deepcopy(course)
        changed["details"]["parallel_groups"][0]["appointments"][0]["Ausfalltermin"] = "05.01.2027"
        second, problems = self._import_incrementally([changed])
        self.assertEqual(problems, [])
        self.assertEqual(first.appointments[0]["id"], second.appointments[0]["id"])
        self.assertEqual(second.appointments[0]["weekday_index"], 1)
        self.assertEqual(len(self._query("SELECT * FROM appointment_cancellations")), 2)
        self.assertNotEqual(plan_course_signatures(first), plan_course_signatures(second))

    def test_legacy_cancellation_header(self) -> None:
        course = _alma_course("237", "u9", "INFO4900", "Prof. New")
        appointment = course["details"]["parallel_groups"][0]["appointments"][0]
        appointment.update({"Rhythmus": "Di. w\u00f6chentlich", "Startdatum - Enddatum": "13.10.2026 - 02.02.2027", "Ausfall": "29.12.2026"})
        plan = build_seed_plan({"courses": [course]})
        self.assertEqual(plan.appointment_cancellations[0]["cancelled_on"], "2026-12-29")
