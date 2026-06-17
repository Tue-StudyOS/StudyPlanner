from __future__ import annotations

import html
import json
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, Tag


MOODLE_BASE_URL = "https://moodle.zdv.uni-tuebingen.de"
DEFAULT_INFORMATICS_CATEGORY_URL = (
    "https://moodle.zdv.uni-tuebingen.de/course/index.php?categoryid=235"
)
COURSE_URL_RE = re.compile(r"/course/view\.php\?id=(\d+)")
PARTICIPANT_LIMIT_TEXT_RE = re.compile(
    r"\b("
    r"teilnehmer(?:zahl)?|participants?|students?|plaetze|plätze|"
    r"beschraenkt|beschränkt|begrenzt|limited|maximum|maximal|hoechstens|höchstens"
    r")\b",
    re.IGNORECASE,
)
PARTICIPANT_LIMIT_NUMBER_RE = re.compile(
    r"(?:max(?:imal(?:e|er|en)?)?|maximum(?: of)?|hoechstens|höchstens|"
    r"bis zu|limited to|beschraenkt auf|beschränkt auf|begrenzt auf)\s+"
    r"(\d{1,4})\s*(?:teilnehmer|participants|students|plaetze|plätze)?",
    re.IGNORECASE,
)
TERM_RE = re.compile(
    r"\b(?:SS|SoSe|Sommer(?:semester)?|WS|WiSe|Winter(?:semester)?)\s*"
    r"(?:20)?\d{2}(?:/\d{2})?\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class MoodleTeacher:
    display_name: str
    profile_url: str | None = None
    moodle_user_id: str | None = None


@dataclass(slots=True)
class MoodleCourse:
    moodle_course_id: str
    category_id: str
    title: str
    normalized_title: str
    course_url: str
    enrol_url: str | None = None
    summary_text: str = ""
    summary_html: str = ""
    teachers: list[MoodleTeacher] = field(default_factory=list)
    detected_terms: list[str] = field(default_factory=list)
    self_enrol_available: bool | None = None
    guest_access: bool | None = None
    limit_mentioned: bool = False
    limit_text: str | None = None
    participant_limit_value: int | None = None
    raw_json: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class MoodleScrapeOptions:
    category_url: str = DEFAULT_INFORMATICS_CATEGORY_URL
    fetch_course_pages: bool = False
    max_pages: int | None = None
    timeout: float = 30.0
    polite_delay: float = 0.15


class MoodleScraper:
    def __init__(self, timeout: float = 30.0, polite_delay: float = 0.15) -> None:
        self.timeout = timeout
        self.polite_delay = polite_delay
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "studyplanner-moodle-scraper/0.1 "
                    "(student course discovery; contact local project owner)"
                )
            }
        )

    def scrape(self, options: MoodleScrapeOptions) -> dict[str, Any]:
        started_at = int(time.time())
        queue = [canonical_category_url(options.category_url)]
        seen_pages: set[str] = set()
        courses_by_id: dict[str, MoodleCourse] = {}
        category_title = ""

        while queue:
            if options.max_pages is not None and len(seen_pages) >= options.max_pages:
                break
            page_url = queue.pop(0)
            if page_url in seen_pages:
                continue
            seen_pages.add(page_url)
            response = self.session.get(page_url, timeout=options.timeout)
            response.raise_for_status()
            response.encoding = "utf-8"
            page = parse_category_page(response.text, response.url)
            category_title = category_title or page["category_title"]
            for course in page["courses"]:
                courses_by_id.setdefault(course.moodle_course_id, course)
            for next_url in page["page_urls"]:
                canonical = canonical_category_url(next_url)
                if canonical not in seen_pages and canonical not in queue:
                    queue.append(canonical)
            time.sleep(options.polite_delay)

        if options.fetch_course_pages:
            for course in courses_by_id.values():
                try:
                    response = self.session.get(course.course_url, timeout=options.timeout)
                    response.raise_for_status()
                    response.encoding = "utf-8"
                    merge_course_page(course, response.text, response.url)
                    time.sleep(options.polite_delay)
                except requests.RequestException as exc:
                    course.raw_json["course_page_error"] = str(exc)

        courses = sorted(courses_by_id.values(), key=lambda course: int(course.moodle_course_id))
        return {
            "source": {
                "category_url": options.category_url,
                "category_id": category_id_from_url(options.category_url) or "",
                "category_title": category_title,
                "fetch_course_pages": options.fetch_course_pages,
                "fetched_at_unix": started_at,
                "finished_at_unix": int(time.time()),
                "page_count": len(seen_pages),
                "course_count": len(courses),
            },
            "courses": [course_to_dict(course) for course in courses],
        }


def parse_category_page(html_text: str, page_url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html_text, "html.parser")
    heading = soup.find("h1")
    category_title = clean_text(heading)
    category_id = category_id_from_url(page_url) or ""
    courses = [
        parse_course_box(box, page_url, category_id)
        for box in soup.select(".coursebox")
        if isinstance(box, Tag)
    ]
    return {
        "category_title": category_title,
        "courses": [course for course in courses if course is not None],
        "page_urls": extract_pagination_urls(soup, page_url),
    }


def parse_course_box(box: Tag, page_url: str, category_id: str) -> MoodleCourse | None:
    link = box.select_one('h3.coursename a[href*="/course/view.php?id="]')
    if not isinstance(link, Tag):
        link = box.select_one('a[href*="/course/view.php?id="]')
    if not isinstance(link, Tag):
        return None

    raw_url = str(link.get("href") or "")
    course_url = urljoin(page_url, html.unescape(raw_url))
    moodle_course_id = str(box.get("data-courseid") or course_id_from_url(course_url) or "")
    if not moodle_course_id:
        return None

    title = clean_text(link)
    summary_node = box.select_one(".summary")
    summary_text = clean_text(summary_node)
    summary_html = inner_html(summary_node)
    teachers = parse_teachers(box, page_url)
    limit_mentioned, limit_text, participant_limit_value = extract_limit_signal(summary_text)

    return MoodleCourse(
        moodle_course_id=moodle_course_id,
        category_id=category_id,
        title=title,
        normalized_title=normalize_whitespace(title).casefold(),
        course_url=course_url,
        enrol_url=build_enrol_url(course_url),
        summary_text=summary_text,
        summary_html=summary_html,
        teachers=teachers,
        detected_terms=unique_preserve_order(TERM_RE.findall(f"{title} {summary_text}")),
        limit_mentioned=limit_mentioned,
        limit_text=limit_text,
        participant_limit_value=participant_limit_value,
        raw_json={
            "coursebox_classes": box.get("class") or [],
            "data_type": box.get("data-type"),
        },
    )


def merge_course_page(course: MoodleCourse, html_text: str, final_url: str) -> None:
    soup = BeautifulSoup(html_text, "html.parser")
    course.raw_json["course_page_url"] = final_url
    body = soup.find("body")
    if isinstance(body, Tag):
        course.guest_access = "guest" in " ".join(str(value) for value in body.get("class") or [])

    text = clean_text(soup)
    if "Gäste können auf diesen Kurs nicht zugreifen" in text:
        course.guest_access = False
    elif "Guests cannot access this course" in text:
        course.guest_access = False

    enrol_labels = [
        clean_text(node)
        for node in soup.find_all(["h2", "h3", "legend"])
        if "einschreibung" in clean_text(node).casefold()
        or "enrol" in clean_text(node).casefold()
    ]
    course.self_enrol_available = any(
        "selbsteinschreibung" in label.casefold() or "self enrol" in label.casefold()
        for label in enrol_labels
    )
    if enrol_labels:
        course.raw_json["enrolment_labels"] = unique_preserve_order(enrol_labels)

    page_limit_mentioned, page_limit_text, page_limit_value = extract_limit_signal(text)
    if page_limit_mentioned and not course.limit_mentioned:
        course.limit_mentioned = True
        course.limit_text = page_limit_text
    if page_limit_value is not None and course.participant_limit_value is None:
        course.participant_limit_value = page_limit_value


def parse_teachers(scope: Tag, page_url: str) -> list[MoodleTeacher]:
    teachers: list[MoodleTeacher] = []
    for item in scope.select("ul.teachers li"):
        link = item.find("a", href=True)
        profile_url = urljoin(page_url, str(link.get("href"))) if isinstance(link, Tag) else None
        display_name = clean_text(link) if isinstance(link, Tag) else clean_text(item)
        display_name = re.sub(r"^Dozent\*in:\s*", "", display_name).strip()
        if not display_name:
            continue
        teachers.append(
            MoodleTeacher(
                display_name=display_name,
                profile_url=profile_url,
                moodle_user_id=moodle_user_id_from_url(profile_url),
            )
        )
    return teachers


def extract_pagination_urls(soup: BeautifulSoup, page_url: str) -> list[str]:
    urls: list[str] = []
    for link in soup.select('a.page-link[href*="course/index.php"]'):
        href = str(link.get("href") or "")
        if not href:
            continue
        absolute = urljoin(page_url, html.unescape(href))
        if category_id_from_url(absolute) == category_id_from_url(page_url):
            urls.append(absolute)
    return unique_preserve_order(urls)


def extract_limit_signal(text: str) -> tuple[bool, str | None, int | None]:
    cleaned = clean_sentence_text(text)
    if not PARTICIPANT_LIMIT_TEXT_RE.search(cleaned):
        return False, None, None

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    limit_sentence = next(
        (sentence for sentence in sentences if PARTICIPANT_LIMIT_TEXT_RE.search(sentence)),
        cleaned[:500],
    )
    number_match = PARTICIPANT_LIMIT_NUMBER_RE.search(limit_sentence)
    value = int(number_match.group(1)) if number_match else None
    return True, limit_sentence.strip()[:1000], value


def course_to_dict(course: MoodleCourse) -> dict[str, Any]:
    record = asdict(course)
    record["teachers"] = [asdict(teacher) for teacher in course.teachers]
    return record


def write_json(path: Path, payload: dict[str, Any], *, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2 if pretty else None),
        encoding="utf-8",
    )


def build_enrol_url(course_url: str) -> str | None:
    course_id = course_id_from_url(course_url)
    if not course_id:
        return None
    return f"{MOODLE_BASE_URL}/enrol/index.php?id={course_id}"


def category_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    query = parse_qs(urlparse(html.unescape(url)).query)
    values = query.get("categoryid")
    return values[0] if values else None


def course_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    query = parse_qs(urlparse(html.unescape(url)).query)
    values = query.get("id")
    if values:
        return values[0]
    match = COURSE_URL_RE.search(url)
    return match.group(1) if match else None


def moodle_user_id_from_url(url: str | None) -> str | None:
    if not url:
        return None
    query = parse_qs(urlparse(html.unescape(url)).query)
    values = query.get("id")
    return values[0] if values else None


def canonical_category_url(url: str) -> str:
    parsed = urlparse(html.unescape(url))
    query = parse_qs(parsed.query)
    flattened = {
        key: values[-1]
        for key, values in query.items()
        if values and key in {"categoryid", "browse", "perpage", "page"}
    }
    return urlunparse(
        (
            parsed.scheme or "https",
            parsed.netloc or urlparse(MOODLE_BASE_URL).netloc,
            parsed.path,
            "",
            urlencode(flattened),
            "",
        )
    )


def clean_text(node: Tag | BeautifulSoup | Any) -> str:
    if node is None:
        return ""
    if isinstance(node, (Tag, BeautifulSoup)):
        return normalize_whitespace(node.get_text(" ", strip=True))
    return normalize_whitespace(str(node))


def inner_html(node: Tag | None) -> str:
    if not isinstance(node, Tag):
        return ""
    return normalize_whitespace("".join(str(child) for child in node.children))


def clean_sentence_text(text: str) -> str:
    return normalize_whitespace(html.unescape(text).replace("\u00a0", " "))


def normalize_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def unique_preserve_order(values: list[str]) -> list[str]:
    unique: list[str] = []
    seen: set[str] = set()
    for value in values:
        cleaned = normalize_whitespace(value)
        key = cleaned.casefold()
        if not cleaned or key in seen:
            continue
        unique.append(cleaned)
        seen.add(key)
    return unique
