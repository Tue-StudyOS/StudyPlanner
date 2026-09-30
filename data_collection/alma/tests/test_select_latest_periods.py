import unittest

from alma.scraper import PeriodOption, select_latest_periods


class SelectLatestPeriodsTest(unittest.TestCase):
    def test_keeps_only_the_newest_parsed_semester(self) -> None:
        periods = [
            PeriodOption("229", "Sommer 2026", (2026, 1)),
            PeriodOption("237", "Winter 2026/27", (2026, 2)),
            PeriodOption("x", "not a semester", None),
        ]

        selected = select_latest_periods(periods)

        self.assertEqual([period.period_id for period in selected], ["237"])

    def test_keeps_every_option_that_shares_the_newest_semester(self) -> None:
        periods = [
            PeriodOption("1", "Winter 2026/27", (2026, 2)),
            PeriodOption("2", "WiSe 2026/27", (2026, 2)),
        ]

        selected = select_latest_periods(periods)

        self.assertEqual([period.period_id for period in selected], ["1", "2"])


if __name__ == "__main__":
    unittest.main()
