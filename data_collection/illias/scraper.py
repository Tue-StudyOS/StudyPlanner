from __future__ import annotations

import re
import time
from dataclasses import asdict
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

from .models import IliasCourse


ILIAS_BASE_URL = "https://ovidius.uni-tuebingen.de"
DEFAULT_INFORMATICS_URL = (
    "https://ovidius.uni-tuebingen.de/ilias.php?"
    "baseClass=ilrepositorygui&ref_id=5459100"
)
FORBIDDEN_ACTION_RE = re.compile(
    r"(join|enrol|enroll|subscribe|beitreten|anmelden|mitgliedschaft|registration)",
    re.IGNORECASE,
)
COURSE_CODE_RE = re.compile(r"\b[A-ZÄÖÜ]{2,}[A-ZÄÖÜ0-9]{1,}[-_/]?[A-Z0-9]*\d{2,}[A-Z0-9-]*\b")
MAX_PARTICIPANTS_RE = re.compile(
    r"(?:max(?:imale)?\.?\s*(?:teilnehmer(?:zahl)?|participants)|teilnehmerbegrenzung)\D{0,20}(\d+)",
    re.IGNORECASE,
)
DEADLINE_RE = re.compile(
    r"(?:frist|deadline|anmeldeschluss|registration until|beitritt bis)[^\n:]*:?\s*([^\n]+)",
    re.IGNORECASE,
)


class IliasScraper:
    def __init__(
        self,
        *,
        username: str,
        password: str,
        base_url: str = ILIAS_BASE_URL,
        timeout: float = 30.0,
        polite_delay: float = 0.2,
    ) -> None:
        self.username = username
        self.password = password
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.polite_delay = polite_delay
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "studyplanner-ilias-scraper/0.1 "
                    "(read-only course metadata discovery)"
                )
            }
        )

    def login(self) -> None:
        start_url = f"{self.base_url}/login.php?target=&client_id=pr02"
        response = self.session.get(start_url, timeout=self.timeout)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        form = _pick_login_form(soup)
        if form is None:
            if _looks_logged_in(soup):
                return
            raise RuntimeError("Could not find ILIAS login form.")

        action = urljoin(response.url, str(form.get("action") or response.url))
        payload = _form_payload(form)
        user_key = _find_input_name(form, ("username", "login", "user", "uid")) or "username"
        password_key = _find_input_name(form, ("password", "passwd", "pass")) or "password"
        payload[user_key] = self.username
        payload[password_key] = self.password
        submit_response = self.session.post(action, data=payload, timeout=self.timeout)
        submit_response.raise_for_status()
        if _pick_login_form(BeautifulSoup(submit_response.text, "html.parser")) is not None:
            raise RuntimeError("ILIAS login did not complete; check credentials or login flow.")

    def scrape_repository(self, start_url: str = DEFAULT_INFORMATICS_URL) -> dict[str, Any]:
        self.login()
        page = self._get_readonly(start_url)
        soup = BeautifulSoup(page.text, "html.parser")
        course_links = _extract_course_links(soup, page.url)
        courses: list[IliasCourse] = []
        seen_ref_ids: set[str] = set()
        for link in course_links:
            ref_id = link["ref_id"]
            if ref_id in seen_ref_ids:
                continue
            seen_ref_ids.add(ref_id)
            detail = self._get_readonly(link["url"])
            courses.append(parse_course_page(detail.text, detail.url, fallback_title=link["title"]))
            time.sleep(self.polite_delay)
        return {
            "source": {
                "start_url": start_url,
                "fetched_at_unix": int(time.time()),
                "read_only_rule": "Scraper fetches pages only and refuses enrol/join/subscribe URLs.",
            },
            "courses": [asdict(course) for course in courses],
        }

    def _get_readonly(self, url: str) -> requests.Response:
        absolute_url = urljoin(self.base_url + "/", url)
        if FORBIDDEN_ACTION_RE.search(absolute_url):
            raise RuntimeError(f"Refusing forbidden enrolment-like URL: {absolute_url}")
        response = self.session.get(absolute_url, timeout=self.timeout)
        response.raise_for_status()
        return response


def parse_course_page(html_text: str, url: str, *, fallback_title: str = "") -> IliasCourse:
    soup = BeautifulSoup(html_text, "html.parser")
    ref_id = _ref_id_from_url(url) or ""
    title = _page_title(soup) or fallback_title
    fields = _extract_fields(soup)
    raw_text = _clean_text(soup)
    description = _first_field(fields, ("Beschreibung", "Description", "Info", "Kurzbeschreibung"))
    instructors = _split_people(
        _first_field(fields, ("Dozent", "Dozent/-in", "Lehrperson", "Tutor", "Administrator"))
    )
    availability = _first_field(fields, ("Verfügbarkeit", "Availability", "Online"))
    registration = _first_field(fields, ("Beitritt", "Anmeldung", "Registration", "Aufnahmemodus"))
    deadline = _first_field(fields, ("Anmeldefrist", "Anmeldeschluss", "Deadline")) or _regex_value(
        DEADLINE_RE, raw_text
    )
    max_participants = _maybe_int(
        _first_field(fields, ("Maximale Teilnehmerzahl", "Teilnehmerbegrenzung", "Max. Teilnehmer"))
    )
    if max_participants is None:
        max_participants = _maybe_int(_regex_value(MAX_PARTICIPANTS_RE, raw_text))
    return IliasCourse(
        ref_id=ref_id,
        title=title,
        url=url,
        object_type=_detect_object_type(soup),
        description=description,
        instructors=instructors,
        availability=availability,
        registration=registration,
        deadline=deadline,
        max_participants=max_participants,
        tags=sorted(set(COURSE_CODE_RE.findall(f"{title} {raw_text}"))),
        fields=fields,
        raw_text=raw_text[:12000],
    )


def _extract_course_links(soup: BeautifulSoup, base_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        text = _clean_text(anchor)
        ref_id = _ref_id_from_url(href)
        if not ref_id or not text or FORBIDDEN_ACTION_RE.search(href):
            continue
        object_context = " ".join(anchor.get("class", [])) + " " + _clean_text(
            anchor.find_parent(["div", "tr", "li"]) or anchor
        )
        if not _looks_like_course_link(href, text, object_context):
            continue
        links.append({"ref_id": ref_id, "title": text, "url": urljoin(base_url, href)})
    return links


def _looks_like_course_link(href: str, text: str, context: str) -> bool:
    haystack = f"{href} {text} {context}".casefold()
    return (
        "baseclass=ilrepositorygui" in haystack
        and ("course" in haystack or "crs" in haystack or COURSE_CODE_RE.search(text) is not None)
    )


def _extract_fields(soup: BeautifulSoup) -> dict[str, str]:
    fields: dict[str, str] = {}
    for row in soup.find_all(["tr", "div", "li"]):
        if not isinstance(row, Tag):
            continue
        label_node = row.find(["th", "dt", "label", "strong"])
        if not isinstance(label_node, Tag):
            continue
        label = _clean_text(label_node).rstrip(":")
        value = _clean_text(row)
        if label and value.startswith(label):
            value = value[len(label) :].lstrip(" :")
        if label and value and len(label) <= 80 and len(value) <= 4000:
            fields.setdefault(label, value)
    meta = soup.find("div", class_=re.compile(r"(il_Info|il_Block|il_TabContent)", re.I))
    if isinstance(meta, Tag):
        for line in _clean_text(meta).split("  "):
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            if key.strip() and value.strip():
                fields.setdefault(key.strip(), value.strip())
    return fields


def _pick_login_form(soup: BeautifulSoup) -> Tag | None:
    for form in soup.find_all("form"):
        if not isinstance(form, Tag):
            continue
        text = str(form).casefold()
        if "password" in text or "passwd" in text:
            return form
    return None


def _form_payload(form: Tag) -> dict[str, str]:
    payload: dict[str, str] = {}
    for control in form.find_all(["input", "button"]):
        if not isinstance(control, Tag):
            continue
        name = control.get("name")
        if not name:
            continue
        control_type = str(control.get("type") or "").lower()
        if control_type in {"checkbox", "radio"} and control.get("checked") is None:
            continue
        payload[str(name)] = str(control.get("value") or "")
    return payload


def _find_input_name(form: Tag, needles: tuple[str, ...]) -> str | None:
    for item in form.find_all("input"):
        if not isinstance(item, Tag):
            continue
        name = str(item.get("name") or "")
        item_id = str(item.get("id") or "")
        item_type = str(item.get("type") or "")
        haystack = f"{name} {item_id} {item_type}".casefold()
        if any(needle in haystack for needle in needles):
            return name or None
    return None


def _looks_logged_in(soup: BeautifulSoup) -> bool:
    text = _clean_text(soup).casefold()
    return "logout" in text or "abmelden" in text


def _page_title(soup: BeautifulSoup) -> str:
    for selector in ("h1", ".ilHeader", ".il_HeaderInner", "title"):
        node = soup.select_one(selector)
        title = _clean_text(node)
        if title:
            return title
    return ""


def _detect_object_type(soup: BeautifulSoup) -> str | None:
    text = str(soup)
    if re.search(r"\bilObjCourseGUI\b|\bcrs\b|Course", text, re.I):
        return "course"
    return None


def _ref_id_from_url(url: str) -> str | None:
    query = parse_qs(urlparse(url).query)
    ref_id = query.get("ref_id") or query.get("refId")
    return ref_id[0] if ref_id else None


def _first_field(fields: dict[str, str], names: tuple[str, ...]) -> str | None:
    normalized = {key.casefold(): value for key, value in fields.items()}
    for name in names:
        value = normalized.get(name.casefold())
        if value:
            return value
    for key, value in fields.items():
        if any(name.casefold() in key.casefold() for name in names):
            return value
    return None


def _split_people(value: str | None) -> list[str]:
    if not value:
        return []
    return [
        part.strip()
        for part in re.split(r";|\n|, (?=[A-ZÄÖÜ][a-zäöüß-]+)", value)
        if part.strip()
    ]


def _regex_value(pattern: re.Pattern[str], text: str) -> str | None:
    match = pattern.search(text)
    return match.group(1).strip() if match else None


def _maybe_int(value: object) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d+", str(value))
    return int(match.group(0)) if match else None


def _clean_text(node: Tag | BeautifulSoup | Any) -> str:
    if node is None:
        return ""
    if isinstance(node, (Tag, BeautifulSoup)):
        return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()
    return re.sub(r"\s+", " ", str(node)).strip()

