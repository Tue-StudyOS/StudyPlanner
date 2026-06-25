import unittest
from pathlib import Path

from alma.scraper import parse_content_page

FIXTURES = Path(__file__).resolve().parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def _section_titled(sections: list[dict[str, str]], title: str) -> dict[str, str] | None:
    for section in sections:
        if section["title"].strip().lower() == title.lower():
            return section
    return None


class ParseContentPageInhalteTest(unittest.TestCase):
    """Regression for the dropped "Inhalte" (Contents) box.

    INF4151's ALMA contents tab stores the real syllabus in a labelled
    `boxStandard` box titled "Inhalte". The parser used to skip every box with
    that title, so the "Aufbauend auf ..." text never reached the database even
    though every other field (Lernziele, Voraussetzung, ...) was captured.
    """

    def setUp(self) -> None:
        self.sections = parse_content_page(_load("inf4151_contents.html"))["sections"]

    def test_inhalte_section_is_captured_with_real_content(self) -> None:
        inhalte = _section_titled(self.sections, "Inhalte")
        self.assertIsNotNone(inhalte, "the 'Inhalte' content box must be captured")
        self.assertIn(
            "Aufbauend auf Angewandte Statistik I werden komplexere statistische Methoden",
            inhalte["text"],
        )

    def test_inhalte_section_excludes_navigation_chrome(self) -> None:
        inhalte = _section_titled(self.sections, "Inhalte")
        self.assertIsNotNone(inhalte)
        # The tab bar / other tab names must not leak into the captured content.
        self.assertNotIn("Semesterplanung", inhalte["text"])
        self.assertNotIn("Weitere Funktionen", inhalte["text"])

    def test_labelled_fields_are_still_captured(self) -> None:
        # The fix must not regress the existing labelled boxes.
        for title in ("Lernziele", "Voraussetzung", "Qualifikationsziel", "Literatur"):
            self.assertIsNotNone(
                _section_titled(self.sections, title),
                f"expected to still capture the '{title}' box",
            )


if __name__ == "__main__":
    unittest.main()
