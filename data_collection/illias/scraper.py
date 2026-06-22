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
    r"(?:max(?:imale|imum)?\.?\s*(?:teilnehmer(?:zahl)?|participants|capacity)|teilnehmerbegrenzung)\D{0,30}(\d+)",
    re.IGNORECASE,
)
DEADLINE_RE = re.compile(
    r"(?:frist|deadline|anmeldeschluss|registration until|beitritt bis)[^\n:]*:?\s*([^\n]+)",
    re.IGNORECASE,
)
REGISTRATION_UNLIMITED_RE = re.compile(r"\bUnbegrenzt\b", re.IGNORECASE)
REGISTRATION_MODE_RE = re.compile(
    r"Aufnahmeverfahren\s+(.{1,180}?)(?=\s+(?:Teilnehmer|Einsichtnahme|Angaben|Zustimmung)|$)",
    re.IGNORECASE,
)
REGISTRATION_DEADLINE_RE = re.compile(
    r"Anmeldungsende:\s*(.{3,100}?)(?=\s+(?:Aufnahmeverfahren|Teilnehmer|Einsichtnahme|Angaben|Zustimmung)|$)",
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
        for _attempt in range(8):
            soup = BeautifulSoup(response.text, "html.parser")
            if _looks_logged_in(soup):
                return

            form = _pick_login_form(soup)
            if form is not None:
                response = self._post_login_form(response.url, form)
                continue

            central_login_url = _central_login_url(soup, response.url)
            if central_login_url:
                response = self.session.get(central_login_url, timeout=self.timeout)
                response.raise_for_status()
                continue

            auto_form = _pick_auto_submit_form(soup)
            if auto_form is not None:
                response = self._post_form(response.url, auto_form, _form_payload(auto_form))
                continue

            break

        raise RuntimeError("ILIAS login did not complete; check credentials or login flow.")

    def _post_login_form(self, page_url: str, form: Tag) -> requests.Response:
        payload = _form_payload(form)
        user_key = _find_input_name(form, ("username", "j_username", "login", "user", "uid")) or "j_username"
        password_key = _find_input_name(form, ("password", "j_password", "passwd", "pass")) or "j_password"
        payload[user_key] = self.username
        payload[password_key] = self.password
        return self._post_form(page_url, form, payload)

    def _post_form(self, page_url: str, form: Tag, payload: dict[str, str]) -> requests.Response:
        action = urljoin(page_url, str(form.get("action") or page_url))
        response = self.session.post(action, data=payload, timeout=self.timeout)
        response.raise_for_status()
        return response

    def scrape_repository(
        self,
        start_url: str = DEFAULT_INFORMATICS_URL,
        *,
        max_courses: int | None = None,
        max_depth: int = 1,
    ) -> dict[str, Any]:
        self.login()
        course_links = self._collect_repository_items(start_url, max_depth=max_depth)
        if max_courses is not None:
            course_links = course_links[: max(max_courses, 0)]
        courses: list[IliasCourse] = []
        seen_ref_ids: set[str] = set()
        for link in course_links:
            ref_id = link["ref_id"]
            if ref_id in seen_ref_ids:
                continue
            seen_ref_ids.add(ref_id)
            detail = self._get_readonly(link["url"])
            course = parse_course_page(detail.text, detail.url, fallback_title=link["title"])
            course.object_type = link.get("object_type") or course.object_type
            _merge_repository_item_metadata(course, link)
            courses.append(course)
            time.sleep(self.polite_delay)
        return {
            "source": {
                "start_url": start_url,
                "fetched_at_unix": int(time.time()),
                "read_only_rule": "Scraper fetches pages only and refuses enrol/join/subscribe URLs.",
            },
            "courses": [asdict(course) for course in courses],
        }

    def _collect_repository_items(self, start_url: str, *, max_depth: int) -> list[dict[str, Any]]:
        queue: list[tuple[str, int]] = [(start_url, 0)]
        seen_pages: set[str] = set()
        seen_items: set[str] = set()
        items: list[dict[str, str]] = []

        while queue:
            page_url, depth = queue.pop(0)
            page = self._get_readonly(page_url)
            if page.url in seen_pages:
                continue
            seen_pages.add(page.url)
            soup = BeautifulSoup(page.text, "html.parser")
            page_items = _extract_course_links(soup, page.url)
            for item in page_items:
                ref_id = item["ref_id"]
                if item.get("object_type") == "crs" and ref_id not in seen_items:
                    seen_items.add(ref_id)
                    items.append(item)
                if item.get("object_type") in {"cat", "crs"} and depth < max_depth:
                    queue.append((item["url"], depth + 1))
            time.sleep(self.polite_delay)
        return items

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
    if not instructors:
        instructors = _people_from_title(title)
    availability = _first_field(fields, ("Verfügbarkeit", "Availability", "Online"))
    registration_period = _first_field(
        fields,
        ("Anmeldungszeitraum", "Beitritt", "Anmeldung", "Registration", "Aufnahmemodus"),
    )
    registration = _clean_registration(
        registration_period,
        raw_text,
        mode=_first_field(fields, ("Aufnahmeverfahren", "Aufnahmemodus")),
    )
    deadline = (
        _first_field(fields, ("Anmeldefrist", "Anmeldeschluss", "Deadline"))
        or _registration_deadline(registration)
        or _registration_deadline(registration_period)
        or _regex_value(DEADLINE_RE, raw_text, max_length=180)
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
        object_type=_detect_object_type(soup, url),
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


def _extract_course_links(soup: BeautifulSoup, base_url: str) -> list[dict[str, Any]]:
    links: list[dict[str, Any]] = []
    seen_ref_ids: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = str(anchor["href"])
        text = _clean_text(anchor)
        classes = {str(class_name) for class_name in anchor.get("class", [])}
        if "il_ContainerItemTitle" not in classes:
            continue
        ref_id = _ref_id_from_url(href)
        if not ref_id or not text or FORBIDDEN_ACTION_RE.search(href):
            continue
        object_type = _object_type_from_url(href)
        if object_type not in {"cat", "crs"}:
            continue
        seen_ref_ids.add(ref_id)
        links.append(
            {
                "ref_id": ref_id,
                "title": text,
                "url": urljoin(base_url, href),
                "object_type": object_type,
            }
        )
    for row in soup.find_all(id=re.compile(r"^item_row_(?:crs|cat)-\d+$")):
        if not isinstance(row, Tag):
            continue
        row_id = str(row.get("id") or "")
        match = re.match(r"^item_row_(crs|cat)-(\d+)$", row_id)
        if not match:
            continue
        object_type, ref_id = match.groups()
        if ref_id in seen_ref_ids:
            continue
        title_node = row.find(["a", "h3"], class_=re.compile(r"\bil_ContainerItemTitle\b"))
        title = _clean_text(title_node)
        if not title:
            continue
        fields = _extract_inline_item_fields(row)
        seen_ref_ids.add(ref_id)
        links.append(
            {
                "ref_id": ref_id,
                "title": title,
                "url": urljoin(base_url, f"/ilias.php?baseClass=ilrepositorygui&ref_id={ref_id}"),
                "object_type": object_type,
                "description": _clean_text(row.find(class_=re.compile(r"\bil_Description\b"))) or "",
                "availability": fields.get("Verfügbarkeit") or fields.get("Availability") or "",
                "registration": fields.get("Anmeldungszeitraum") or fields.get("Registration") or "",
                "raw_text": _clean_text(row),
            }
        )
    return links


def _extract_inline_item_fields(row: Tag) -> dict[str, str]:
    fields: dict[str, str] = {}
    for node in row.find_all(class_=re.compile(r"\bil_ItemProperty\b")):
        text = _clean_text(node)
        if ":" not in text:
            continue
        key, value = text.split(":", 1)
        if key.strip() and value.strip():
            fields.setdefault(key.strip(), value.strip())
    return fields


def _merge_repository_item_metadata(course: IliasCourse, item: dict[str, Any]) -> None:
    description = str(item.get("description") or "").strip()
    availability = str(item.get("availability") or "").strip()
    registration = str(item.get("registration") or "").strip()
    raw_text = str(item.get("raw_text") or "").strip()

    if description and not course.description:
        course.description = description
    if availability and not course.availability:
        course.availability = availability
    if registration and not course.registration:
        course.registration = registration
    if course.max_participants is None:
        course.max_participants = _maybe_int(_regex_value(MAX_PARTICIPANTS_RE, f"{description} {raw_text}"))


def _extract_fields(soup: BeautifulSoup) -> dict[str, str]:
    fields: dict[str, str] = {}
    for property_row in soup.find_all(class_=re.compile(r"\bil-item-property\b")):
        if not isinstance(property_row, Tag):
            continue
        label_node = property_row.find(class_=re.compile(r"\bil-item-property-name\b"))
        value_node = property_row.find(class_=re.compile(r"\bil-item-property-value\b"))
        label = _clean_text(label_node).rstrip(":")
        value = _clean_text(value_node)
        if label and value:
            fields.setdefault(label, value)

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


def _central_login_url(soup: BeautifulSoup, base_url: str) -> str | None:
    for anchor in soup.find_all("a", href=True):
        if not isinstance(anchor, Tag):
            continue
        href = str(anchor.get("href") or "")
        text = _clean_text(anchor)
        haystack = f"{href} {text}".casefold()
        if "shib_login" in haystack or "zentraler universitäts-kennung" in haystack:
            return urljoin(base_url, href)
    return None


def _pick_auto_submit_form(soup: BeautifulSoup) -> Tag | None:
    for form in soup.find_all("form"):
        if not isinstance(form, Tag):
            continue
        if _pick_login_form(BeautifulSoup(str(form), "html.parser")) is not None:
            continue
        payload = _form_payload(form)
        if payload and form.get("action"):
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


def _detect_object_type(soup: BeautifulSoup, url: str) -> str | None:
    object_type = _object_type_from_url(url)
    if object_type:
        return object_type
    text = str(soup)
    if re.search(r"\bilObjCourseGUI\b|\bcrs\b|Course", text, re.I):
        return "course"
    return None


def _ref_id_from_url(url: str) -> str | None:
    query = parse_qs(urlparse(url).query)
    ref_id = query.get("ref_id") or query.get("refId")
    if ref_id:
        return ref_id[0]
    match = re.search(r"/(?:goto\.php/)?(?:cat|crs|grp|fold)/(\d+)", urlparse(url).path)
    return match.group(1) if match else None


def _object_type_from_url(url: str) -> str | None:
    path = urlparse(url).path
    match = re.search(r"/(?:goto\.php/)?(cat|crs|grp|fold)/\d+", path)
    if match:
        return match.group(1)
    if "type=crs" in url:
        return "crs"
    if "type=cat" in url:
        return "cat"
    return None


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


def _people_from_title(title: str) -> list[str]:
    people: list[str] = []
    for value in re.findall(r"\(([^)]{3,120})\)", title):
        cleaned = re.sub(r"\bProf\.?(?:\s+Dr\.?)?|\bDr\.?|\bJun\.-Prof\.?", "", value).strip()
        for part in re.split(r";|,| und | and ", cleaned):
            person = part.strip()
            if len(person.split()) >= 2:
                people.append(person)
    return people


def _clean_registration(value: str | None, raw_text: str, *, mode: str | None = None) -> str | None:
    candidates = [value, raw_text]
    for candidate in candidates:
        if not candidate:
            continue
        pieces: list[str] = []
        if REGISTRATION_UNLIMITED_RE.search(candidate):
            pieces.append("Unbegrenzt")
        mode_text = mode or _regex_value(REGISTRATION_MODE_RE, candidate, max_length=180)
        if mode_text:
            pieces.append(mode_text.rstrip(".") + ".")
        if pieces:
            return " ".join(pieces)
        cleaned = candidate.strip()
        if 0 < len(cleaned) <= 180 and "Einsichtnahme" not in cleaned and "Zustimmung" not in cleaned:
            return cleaned
    return None


def _registration_deadline(registration: str | None) -> str | None:
    if not registration:
        return None
    return _regex_value(REGISTRATION_DEADLINE_RE, registration, max_length=100)


def _regex_value(pattern: re.Pattern[str], text: str, *, max_length: int | None = None) -> str | None:
    match = pattern.search(text)
    if not match:
        return None
    value = match.group(1).strip()
    if max_length is not None and len(value) > max_length:
        return None
    return value


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
