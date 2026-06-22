from __future__ import annotations

import unittest

from data_collection.illias.scraper import IliasScraper, parse_course_page


class FakeResponse:
    def __init__(self, url: str, text: str) -> None:
        self.url = url
        self.text = text


class IliasScraperParsingTests(unittest.TestCase):
    def test_collect_repository_items_uses_categories_only_for_traversal(self) -> None:
        start_url = "https://ovidius.uni-tuebingen.de/ilias.php?baseClass=ilrepositorygui&ref_id=1"
        category_url = "https://ovidius.uni-tuebingen.de/goto.php/cat/2"
        course_url = "https://ovidius.uni-tuebingen.de/goto.php/crs/3"
        nested_course_url = "https://ovidius.uni-tuebingen.de/goto.php/crs/4"
        pages = {
            start_url: f"""
            <a class="il_ContainerItemTitle" href="{category_url}">Chair Category</a>
            <a class="il_ContainerItemTitle" href="{course_url}">Real Course</a>
            """,
            category_url: f"""
            <a class="il_ContainerItemTitle" href="{nested_course_url}">Nested Course</a>
            """,
        }
        scraper = IliasScraper(username="user", password="secret", polite_delay=0)
        scraper._get_readonly = lambda url: FakeResponse(url, pages[url])  # type: ignore[method-assign]

        items = scraper._collect_repository_items(start_url, max_depth=1)

        self.assertEqual([item["ref_id"] for item in items], ["3", "4"])
        self.assertEqual([item["object_type"] for item in items], ["crs", "crs"])

    def test_extracts_registration_deadline_and_capacity_without_profile_consent_text(self) -> None:
        html = """
        <html>
          <body>
            <h1>Programming in C++ - SS 2026</h1>
            <div class="il-item-property">
              <span class="il-item-property-name">Anmeldungszeitraum</span>
              <span class="il-item-property-value">
                Anmeldungsende: 11. Sep 2026, 00:00
                Aufnahmeverfahren Sie können diesem Kurs direkt beitreten.
                Teilnehmer Maximale Teilnehmeranzahl: 200 Freie Plätze: 76
                Einsichtnahme in personenbezogene Daten Zustimmung *
              </span>
            </div>
            <div class="il-item-property">
              <span class="il-item-property-name">Aufnahmeverfahren</span>
              <span class="il-item-property-value">Sie können diesem Kurs direkt beitreten.</span>
            </div>
            <div class="il-item-property">
              <span class="il-item-property-name">Teilnehmer</span>
              <span class="il-item-property-value">Maximale Teilnehmeranzahl: 200 Freie Plätze: 76</span>
            </div>
          </body>
        </html>
        """

        course = parse_course_page(html, "https://ovidius.uni-tuebingen.de/goto.php/crs/5509434")

        self.assertEqual(course.ref_id, "5509434")
        self.assertEqual(course.deadline, "11. Sep 2026, 00:00")
        self.assertEqual(course.registration, "Sie können diesem Kurs direkt beitreten.")
        self.assertEqual(course.max_participants, 200)
        self.assertNotIn("Einsichtnahme", course.registration or "")
        self.assertNotIn("Zustimmung", course.registration or "")

    def test_extracts_unlimited_registration_mode(self) -> None:
        html = """
        <html>
          <body>
            <h1>Basics of Machine Learning</h1>
            <div class="il-item-property">
              <span class="il-item-property-name">Anmeldungszeitraum</span>
              <span class="il-item-property-value">
                Unbegrenzt Aufnahmeverfahren Sie können diesem Kurs direkt beitreten.
              </span>
            </div>
          </body>
        </html>
        """

        course = parse_course_page(html, "https://ovidius.uni-tuebingen.de/goto.php/crs/5484245")

        self.assertIsNone(course.deadline)
        self.assertEqual(course.registration, "Unbegrenzt Sie können diesem Kurs direkt beitreten.")


if __name__ == "__main__":
    unittest.main()
