import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[2]))

from data_collection.moodle.scraper import extract_limit_signal, parse_category_page  # noqa: E402


class MoodleCategoryParserTest(unittest.TestCase):
    def test_extracts_course_cards_teachers_limits_and_pagination(self) -> None:
        html = """
        <html><body>
          <h1>Informatik</h1>
          <div class="courses category-browse category-browse-235">
            <a class="page-link" href="/course/index.php?categoryid=235&amp;browse=courses&amp;page=1">2</a>
            <div class="coursebox clearfix" data-courseid="1630" data-type="1">
              <h3 class="coursename">
                <a href="https://moodle.zdv.uni-tuebingen.de/course/view.php?id=1630">
                  INF3332 - Internet-Praktikum 1 (SoSe 26)
                </a>
              </h3>
              <div class="summary">
                <p>Die Anzahl der Teilnehmer ist beschraenkt, es wird ein Auswahlverfahren geben.</p>
              </div>
              <ul class="teachers">
                <li><span>Dozent*in: </span><a href="/user/profile.php?id=294">Moritz Fluechter</a></li>
              </ul>
            </div>
          </div>
        </body></html>
        """

        page = parse_category_page(
            html,
            "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235",
        )

        self.assertEqual(page["category_title"], "Informatik")
        self.assertEqual(page["page_urls"], [
            "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235&browse=courses&page=1"
        ])
        course = page["courses"][0]
        self.assertEqual(course.moodle_course_id, "1630")
        self.assertEqual(course.category_id, "235")
        self.assertEqual(course.detected_terms, ["SoSe 26"])
        self.assertTrue(course.limit_mentioned)
        self.assertIsNone(course.participant_limit_value)
        self.assertEqual(course.teachers[0].display_name, "Moritz Fluechter")
        self.assertEqual(course.teachers[0].moodle_user_id, "294")


class MoodleLimitSignalTest(unittest.TestCase):
    def test_extracts_numeric_limit_when_public_text_contains_one(self) -> None:
        mentioned, sentence, value = extract_limit_signal(
            "The lab is limited to 24 participants. Attendance is required."
        )

        self.assertTrue(mentioned)
        self.assertEqual(sentence, "The lab is limited to 24 participants.")
        self.assertEqual(value, 24)


if __name__ == "__main__":
    unittest.main()
