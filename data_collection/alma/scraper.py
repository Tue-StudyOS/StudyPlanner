from __future__ import annotations

import html
import json
import re
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from collections.abc import Callable
from typing import Any
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag


CATALOG_PREFIX = "hierarchy:content-container:courseCatalogFieldset:courseCatalog:"
ALMA_BASE = "https://alma.uni-tuebingen.de"
# ALMA caps the "Module / Studiengänge" page-size input ("Zeilen pro Seite") at 300.
MODULE_ROWS_PER_PAGE = 300


@dataclass(slots=True)
class ScrapeOptions:
    start_url: str
    branch_title: str | None = None
    max_depth: int | None = None
    max_courses: int | None = None
    fetch_details: bool = False
    latest_versions_only: bool = True
    progress_file: str | None = None
    checkpoint_path: str | None = None
    checkpoint_every: int = 25
    restrict_to_start_path: bool = True
    max_runtime_seconds: int | None = None
    max_expansions: int | None = None


@dataclass(slots=True)
class CatalogNode:
    node_id: str
    level: int
    title: str
    kind: str
    permalink: str | None = None
    detail_url: str | None = None
    unit_id: str | None = None
    period_id: str | None = None
    expandable: bool = False
    expanded: bool = False
    parent_id: str | None = None
    path_titles: list[str] = field(default_factory=list)
    raw_schedule: list[str] = field(default_factory=list)


class AlmaScraper:
    DEFAULT_CATALOG_URL = (
        "https://alma.uni-tuebingen.de/alma/pages/cm/exa/coursecatalog/"
        "showCourseCatalog.xhtml?_flowId=showCourseCatalog-flow"
    )
    # Faculty of Science (Mathematisch-Naturwissenschaftliche Fakultät)
    FACULTY_OF_SCIENCE_URL = (
        "https://alma.uni-tuebingen.de:443/alma/pages/startFlow.xhtml?"
        "_flowId=showCourseCatalog-flow&periodId=229&"
        "path=title%3A18504%7Ctitle%3A18512&"
        "navigationPosition=studiesOffered,courseoverviewShow"
    )
    # Gesamtverzeichnis Lehrveranstaltungen Informatik (a branch of the Faculty of Science).
    INFORMATICS_COURSES_URL = (
        "https://alma.uni-tuebingen.de:443/alma/pages/startFlow.xhtml?"
        "_flowId=showCourseCatalog-flow&periodId=229&"
        "path=title%3A18504%7Ctitle%3A18512%7Ctitle%3A19074%7Ctitle%3A19158&"
        "navigationPosition=studiesOffered,courseoverviewShow"
    )

    def __init__(
        self,
        timeout: float = 30.0,
        polite_delay: float = 0.15,
        progress: Callable[[str], None] | None = None,
    ) -> None:
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "alma-course-scraper/0.1 "
                    "(student course discovery; contact local project owner)"
                )
            }
        )
        self.timeout = timeout
        self.polite_delay = polite_delay
        self.catalog_action_url: str | None = None
        self.view_state: str | None = None
        self.authenticity_token: str | None = None
        self.catalog_nodes: dict[str, CatalogNode] = {}
        self.skipped_old_version_node_ids: set[str] = set()
        self.start_catalog_path: str | None = None
        self.progress = progress

    def scrape(self, options: ScrapeOptions) -> dict[str, Any]:
        branch_title = repair_mojibake(options.branch_title) if options.branch_title else None
        started_at = int(time.time())
        self.start_catalog_path = (
            catalog_path_from_url(options.start_url) if options.restrict_to_start_path else None
        )
        self._progress(options, "start", "Fetching catalog start page")
        html_text = self.fetch_catalog_page(options.start_url)
        self.catalog_nodes = self.parse_catalog_nodes(html_text)
        self._mark_old_version_nodes(options)
        timed_out = self._crawl_catalog(options, started_at)
        self._progress(
            options,
            "catalog_done",
            f"Catalog crawl {'paused' if timed_out else 'done'}: {len(self.catalog_nodes)} nodes discovered",
        )

        courses = [node for node in self.catalog_nodes.values() if self._is_course(node)]
        courses = [node for node in courses if self._is_in_start_path_scope(node)]
        if options.latest_versions_only:
            courses = [node for node in courses if not self._is_skipped_old_version(node)]
        if branch_title:
            needle = branch_title.casefold()
            courses = [
                node
                for node in courses
                if any(needle in title.casefold() for title in node.path_titles)
            ]
        courses = unique_courses(courses)
        courses.sort(key=lambda item: item.node_id)
        if options.max_courses is not None:
            courses = courses[: options.max_courses]

        course_records: list[dict[str, Any]] = []
        total_courses = len(courses)
        for index, course in enumerate(courses, start=1):
            if self._runtime_exceeded(options, started_at):
                self._progress(
                    options,
                    "paused",
                    f"Runtime limit reached before detail {index}/{total_courses}",
                    course_index=index,
                    total_courses=total_courses,
                )
                break
            self._progress(
                options,
                "details",
                f"Fetching detail {index}/{total_courses}: {course.title}",
                course_index=index,
                total_courses=total_courses,
                current_course=course.title,
            )
            record = asdict(course)
            if options.fetch_details and course.detail_url:
                record["details"] = self.fetch_course_details(course.detail_url)
                time.sleep(self.polite_delay)
            course_records.append(record)
            if options.checkpoint_path and index % max(options.checkpoint_every, 1) == 0:
                self._write_checkpoint(options, started_at, course_records)

        result = {
            "source": {
                "start_url": options.start_url,
                "branch_title": branch_title,
                "latest_versions_only": options.latest_versions_only,
                "skipped_old_version_nodes": sorted(self.skipped_old_version_node_ids),
                "partial": self._runtime_exceeded(options, started_at),
                "fetched_at_unix": started_at,
                "finished_at_unix": int(time.time()),
            },
            "catalog_nodes": [asdict(node) for node in self.catalog_nodes.values()],
            "courses": course_records,
        }
        if options.checkpoint_path:
            self._write_json(Path(options.checkpoint_path), result)
        self._progress(options, "done", f"Done: {len(course_records)} courses written")
        return result

    def fetch_catalog_page(self, url: str) -> str:
        response = self.session.get(url, timeout=self.timeout, allow_redirects=True)
        response.raise_for_status()
        response.encoding = "utf-8"
        text = response.text
        soup = BeautifulSoup(text, "html.parser")
        form = soup.find("form", id="hierarchy")
        if not isinstance(form, Tag):
            raise RuntimeError("Could not find ALMA catalog form with id='hierarchy'.")
        action = form.get("action")
        if not action:
            raise RuntimeError("Could not find ALMA catalog form action.")
        self.catalog_action_url = urljoin(response.url, str(action))
        self.view_state = self._input_value(form, "javax.faces.ViewState")
        self.authenticity_token = self._input_value(form, "authenticity_token")
        if not self.view_state or not self.authenticity_token:
            raise RuntimeError("Missing JSF ViewState or ALMA authenticity token.")
        return text

    def _crawl_catalog(self, options: ScrapeOptions, started_at: int) -> bool:
        queue = list(self.catalog_nodes.values())
        seen_expansions: set[str] = set()
        branch_matched = options.branch_title is None
        expansions = 0

        while queue:
            if self._runtime_exceeded(options, started_at):
                self._progress(
                    options,
                    "paused",
                    "Runtime limit reached during catalog expansion",
                    discovered_nodes=len(self.catalog_nodes),
                    queued_nodes=len(queue),
                    expansions=expansions,
                )
                return True
            if options.max_expansions is not None and expansions >= options.max_expansions:
                self._progress(
                    options,
                    "paused",
                    "Expansion limit reached during catalog crawl",
                    discovered_nodes=len(self.catalog_nodes),
                    queued_nodes=len(queue),
                    expansions=expansions,
                )
                return True
            node = queue.pop(0)
            if node.node_id in seen_expansions:
                continue
            if not node.expandable or node.expanded:
                continue
            if not self._is_in_start_path_scope(node):
                continue
            if self._is_skipped_old_version(node):
                continue
            if options.max_depth is not None and node.level >= options.max_depth:
                continue

            inside_hit_branch = False
            if options.branch_title:
                needle = repair_mojibake(options.branch_title).casefold()
                title_hit = needle in node.title.casefold()
                inside_hit_branch = any(needle in title.casefold() for title in node.path_titles)
                if branch_matched and not inside_hit_branch:
                    continue
                branch_matched = branch_matched or title_hit

            self._progress(
                options,
                "expand",
                f"Expanding node {node.node_id}: {node.title}",
                discovered_nodes=len(self.catalog_nodes),
                queued_nodes=len(queue),
            )
            fragment = self.expand_node(node)
            expansions += 1
            seen_expansions.add(node.node_id)
            new_nodes = self.parse_catalog_nodes(fragment)
            for node_id, new_node in new_nodes.items():
                if node_id not in self.catalog_nodes:
                    self.catalog_nodes[node_id] = new_node
                    queue.append(new_node)
                else:
                    old = self.catalog_nodes[node_id]
                    old.expanded = old.expanded or new_node.expanded
                    old.expandable = old.expandable or new_node.expandable
            self._mark_old_version_nodes(options)

            if options.max_courses is not None and (not options.branch_title or branch_matched):
                if self._course_count_for_options(options) >= options.max_courses:
                    break
            time.sleep(self.polite_delay)
        return False

    def expand_node(self, node: CatalogNode) -> str:
        if not self.catalog_action_url or not self.view_state or not self.authenticity_token:
            raise RuntimeError("Catalog session is not initialized.")

        button_id = f"{CATALOG_PREFIX}{node.node_id}:t2g_{node.node_id.replace(':', '-')}"
        children_id = f"{CATALOG_PREFIX}{node.node_id}:children"
        data = {
            "javax.faces.partial.ajax": "true",
            "javax.faces.source": button_id,
            "javax.faces.partial.execute": f"{children_id} ",
            "javax.faces.partial.render": f"{children_id} hierarchy:messages-infobox ",
            "javax.faces.behavior.event": "action",
            "hierarchy": "hierarchy",
            "hierarchy_SUBMIT": "1",
            "authenticity_token": self.authenticity_token,
            "javax.faces.ViewState": self.view_state,
            button_id: button_id,
        }
        response = self.session.post(
            self.catalog_action_url,
            data=data,
            headers={
                "Faces-Request": "partial/ajax",
                "X-Requested-With": "XMLHttpRequest",
            },
            timeout=self.timeout,
        )
        response.raise_for_status()
        response.encoding = "utf-8"
        text = response.text
        self._update_view_state_from_partial(text)
        return self._partial_html(text)

    def fetch_course_details(self, detail_url: str) -> dict[str, Any]:
        response = self.session.get(
            urljoin(ALMA_BASE, detail_url),
            timeout=self.timeout,
            allow_redirects=True,
        )
        response.raise_for_status()
        response.encoding = "utf-8"
        details = parse_detail_page(response.text, response.url)
        content_html = self._submit_detail_tab(response.text, response.url, "contentsTab")
        if content_html:
            details["content"] = parse_content_page(content_html)
        details["categories"] = self.fetch_course_categories(response.text, response.url)
        return details

    def fetch_course_categories(self, detail_page_html: str, current_url: str) -> list[str]:
        """Return the module/study-program codes a course is assigned to.

        These codes come from the 'Module / Studiengänge' detail tab. That
        tab's table is paginated, so the page-size input is raised first to
        make sure every assignment is included.
        """
        tab_html = self._submit_detail_tab(
            detail_page_html, current_url, "modulesCourseOfStudiesTab"
        )
        if not tab_html:
            return []
        if _module_table_is_paginated(tab_html):
            expanded = self._expand_module_rows(tab_html, current_url)
            if expanded:
                tab_html = expanded
        return parse_module_categories(tab_html)

    def _expand_module_rows(self, tab_html: str, current_url: str) -> str | None:
        """Re-render the module table with a large page size so no rows stay hidden."""
        soup = BeautifulSoup(tab_html, "html.parser")
        rows_input = soup.find("input", id=re.compile(r"NumRowsInput$"))
        if not isinstance(rows_input, Tag):
            return None
        input_name = rows_input.get("name")
        if not input_name:
            return None
        return self._submit_detail_form(
            tab_html,
            current_url,
            re.compile(r"NumRowsRefresh$"),
            {str(input_name): str(MODULE_ROWS_PER_PAGE)},
        )

    def _submit_detail_tab(self, page_html: str, current_url: str, tab_suffix: str) -> str | None:
        return self._submit_detail_form(
            page_html,
            current_url,
            re.compile(rf":tabs:{re.escape(tab_suffix)}$"),
            {},
        )

    def _submit_detail_form(
        self,
        page_html: str,
        current_url: str,
        button_id_pattern: re.Pattern[str],
        overrides: dict[str, str],
    ) -> str | None:
        """Re-submit the detail-page form by pressing one button.

        Collects every input/select of the ``detailViewData`` form, applies
        ``overrides``, presses the button matched by ``button_id_pattern``,
        and returns the response HTML.
        """
        soup = BeautifulSoup(page_html, "html.parser")
        form = soup.find("form", id="detailViewData")
        if not isinstance(form, Tag):
            return None
        button = form.find("button", id=button_id_pattern)
        if not isinstance(button, Tag):
            return None
        data: dict[str, str] = {}
        for item in form.find_all("input"):
            name = item.get("name")
            if name:
                data[str(name)] = str(item.get("value", ""))
        for select in form.find_all("select"):
            name = select.get("name")
            if not name:
                continue
            option = select.find("option", selected=True) or select.find("option")
            data[str(name)] = str(option.get("value", "")) if isinstance(option, Tag) else ""

        data.update(overrides)
        button_name = str(button.get("name"))
        data[button_name] = button_name
        data["DISABLE_VALIDATION"] = "true"
        action = form.get("action")
        if not action:
            return None
        response = self.session.post(
            urljoin(current_url, str(action)),
            data=data,
            timeout=self.timeout,
            allow_redirects=True,
        )
        response.raise_for_status()
        response.encoding = "utf-8"
        return response.text

    def parse_catalog_nodes(self, html_text: str) -> dict[str, CatalogNode]:
        soup = BeautifulSoup(self._partial_html(html_text), "html.parser")
        rows = [
            row
            for row in soup.find_all("tr", id=True)
            if str(row["id"]).startswith(CATALOG_PREFIX) and str(row["id"]).endswith(":row")
        ]
        nodes: dict[str, CatalogNode] = {}
        path_stack: dict[int, str] = {}

        for row in rows:
            node_id = str(row["id"])[len(CATALOG_PREFIX) : -len(":row")]
            level = self._row_level(row)
            parent_id = ":".join(node_id.split(":")[:-1]) or None
            title = self._row_title(row)
            kind = self._row_kind(row)
            permalink = self._row_permalink(row)
            detail_url = self._row_detail_url(row)
            unit_id, period_id = self._unit_and_period(detail_url)
            expandable, expanded = self._row_expand_state(row)
            raw_schedule = self._parallel_group_lines(row) if kind == "Parallelgruppe" else []

            path_stack[level] = title
            for stale_level in [key for key in path_stack if key > level]:
                del path_stack[stale_level]
            path_titles = [path_stack[key] for key in sorted(path_stack)]

            nodes[node_id] = CatalogNode(
                node_id=node_id,
                level=level,
                title=title,
                kind=kind,
                permalink=permalink,
                detail_url=detail_url,
                unit_id=unit_id,
                period_id=period_id,
                expandable=expandable,
                expanded=expanded,
                parent_id=parent_id,
                path_titles=path_titles,
                raw_schedule=raw_schedule,
            )
        return nodes

    @staticmethod
    def _is_course(node: CatalogNode) -> bool:
        return node.kind == "Veranstaltung" and bool(node.detail_url)

    def _course_count_for_options(self, options: ScrapeOptions) -> int:
        courses = [node for node in self.catalog_nodes.values() if self._is_course(node)]
        if not options.branch_title:
            return len(unique_courses(courses))
        needle = repair_mojibake(options.branch_title).casefold()
        return len(
            unique_courses(
                [
                    node
                    for node in courses
                    if any(needle in title.casefold() for title in node.path_titles)
                ]
            )
        )

    def _mark_old_version_nodes(self, options: ScrapeOptions) -> None:
        if not options.latest_versions_only:
            return
        sibling_groups: dict[tuple[str | None, int, str], list[tuple[int, CatalogNode]]] = {}
        for node in self.catalog_nodes.values():
            parsed = parse_versioned_title(node.title)
            if not parsed:
                continue
            base_title, version_year = parsed
            key = (node.parent_id, node.level, base_title.casefold())
            sibling_groups.setdefault(key, []).append((version_year, node))

        for versions in sibling_groups.values():
            latest_year = max(year for year, _node in versions)
            for year, node in versions:
                if year < latest_year:
                    self.skipped_old_version_node_ids.add(node.node_id)

    def _is_skipped_old_version(self, node: CatalogNode) -> bool:
        return any(
            node.node_id == skipped_id or node.node_id.startswith(f"{skipped_id}:")
            for skipped_id in self.skipped_old_version_node_ids
        )

    def _is_in_start_path_scope(self, node: CatalogNode) -> bool:
        if not self.start_catalog_path:
            return True
        node_path = catalog_path_from_url(node.permalink)
        if not node_path:
            return True
        return (
            node_path == self.start_catalog_path
            or node_path.startswith(f"{self.start_catalog_path}|")
            or self.start_catalog_path.startswith(f"{node_path}|")
        )

    def _write_checkpoint(
        self,
        options: ScrapeOptions,
        started_at: int,
        course_records: list[dict[str, Any]],
    ) -> None:
        if not options.checkpoint_path:
            return
        payload = {
            "source": {
                "start_url": options.start_url,
                "branch_title": repair_mojibake(options.branch_title) if options.branch_title else None,
                "latest_versions_only": options.latest_versions_only,
                "skipped_old_version_nodes": sorted(self.skipped_old_version_node_ids),
                "fetched_at_unix": started_at,
                "checkpoint_at_unix": int(time.time()),
                "partial": True,
            },
            "catalog_nodes": [asdict(node) for node in self.catalog_nodes.values()],
            "courses": course_records,
        }
        self._write_json(Path(options.checkpoint_path), payload)

    @staticmethod
    def _runtime_exceeded(options: ScrapeOptions, started_at: int) -> bool:
        if options.max_runtime_seconds is None:
            return False
        return time.time() - started_at >= options.max_runtime_seconds

    def _progress(self, options: ScrapeOptions, stage: str, message: str, **extra: Any) -> None:
        payload = {
            "stage": stage,
            "message": message,
            "timestamp_unix": int(time.time()),
            "catalog_nodes": len(self.catalog_nodes),
            "skipped_old_version_nodes": len(self.skipped_old_version_node_ids),
            **extra,
        }
        if self.progress:
            self.progress(message)
        if options.progress_file:
            self._write_json(Path(options.progress_file), payload)

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _partial_html(text: str) -> str:
        chunks = re.findall(r"<!\[CDATA\[(.*?)\]\]>", text, flags=re.S)
        return "\n".join(chunks) if chunks else text

    def _update_view_state_from_partial(self, text: str) -> None:
        match = re.search(
            r'<update id="[^"]*javax\.faces\.ViewState[^"]*"><!\[CDATA\[(.*?)\]\]></update>',
            text,
            flags=re.S,
        )
        if match:
            self.view_state = html.unescape(match.group(1).strip())

    @staticmethod
    def _input_value(form: Tag, name: str) -> str | None:
        item = form.find("input", attrs={"name": name})
        if not isinstance(item, Tag):
            return None
        value = item.get("value")
        return str(value) if value is not None else None

    @staticmethod
    def _row_level(row: Tag) -> int:
        classes = row.get("class", [])
        for class_name in classes:
            match = re.match(r"treeTableCellLevel(\d+)", str(class_name))
            if match:
                return int(match.group(1))
        invisible = row.find("td", class_="invisible")
        if invisible:
            return max(clean_text(invisible).count("."), 0)
        return 0

    @staticmethod
    def _row_title(row: Tag) -> str:
        link = row.find("a", class_="linkTableTree")
        if isinstance(link, Tag):
            return clean_text(link)
        title_span = row.find(id=re.compile(r":ot_3$"))
        if isinstance(title_span, Tag):
            return clean_text(title_span)
        permalink_text = row.find("textarea", attrs={"data-page-permalink-title": True})
        if isinstance(permalink_text, Tag):
            title = permalink_text.get("data-page-permalink-title")
            if title:
                return clean_whitespace(str(title))
        cells = row.find_all("td")
        return clean_text(cells[-2] if len(cells) > 1 else row)

    @staticmethod
    def _row_kind(row: Tag) -> str:
        image = row.find("img", alt=True)
        if isinstance(image, Tag) and image.get("alt"):
            return clean_whitespace(str(image["alt"]))
        if "Parallelgruppe" in clean_text(row):
            return "Parallelgruppe"
        return "Unbekannt"

    @staticmethod
    def _row_permalink(row: Tag) -> str | None:
        textarea = row.find("textarea", attrs={"data-page-permalink": "false"})
        if isinstance(textarea, Tag):
            return html.unescape(clean_text(textarea))
        hidden = row.find("input", id="autologinRequestUrl")
        if isinstance(hidden, Tag) and hidden.get("value"):
            return html.unescape(str(hidden["value"]))
        return None

    @staticmethod
    def _row_detail_url(row: Tag) -> str | None:
        link = row.find("a", href=re.compile(r"detailView-flow"))
        if isinstance(link, Tag):
            return html.unescape(str(link["href"]))
        return None

    @staticmethod
    def _row_expand_state(row: Tag) -> tuple[bool, bool]:
        button = row.find("button", id=re.compile(r":t2g_"))
        if not isinstance(button, Tag):
            return False, False
        expanded = str(button.get("aria-expanded", "")).lower() == "true"
        return True, expanded

    @staticmethod
    def _parallel_group_lines(row: Tag) -> list[str]:
        items = row.find_all("li")
        return [clean_text(item) for item in items if clean_text(item)]

    @staticmethod
    def _unit_and_period(detail_url: str | None) -> tuple[str | None, str | None]:
        if not detail_url:
            return None, None
        query = parse_qs(urlparse(html.unescape(detail_url)).query)
        return first(query.get("unitId")), first(query.get("periodId"))


def parse_detail_page(html_text: str, final_url: str | None = None) -> dict[str, Any]:
    soup = BeautifulSoup(html_text, "html.parser")
    title = clean_text(soup.find("h1"))
    base = soup.find(id="detailViewData:tabContainer:term-planning-container:basicDataTabfieldsetId")
    base_fields = parse_label_items(base if isinstance(base, Tag) else soup)

    parallel_groups = []
    for group in soup.find_all(id=re.compile(r"parallelGroupSchedule_\d+$")):
        if not isinstance(group, Tag):
            continue
        heading = group.find(["h3", "legend"])
        group_record = {
            "title": clean_text(heading),
            "fields": parse_label_items(group),
            "appointments": parse_appointment_tables(group),
        }
        parallel_groups.append(group_record)

    return {
        "url": final_url,
        "page_title": title,
        "fields": base_fields,
        "parallel_groups": parallel_groups,
    }


def parse_content_page(html_text: str) -> dict[str, Any]:
    soup = BeautifulSoup(html_text, "html.parser")
    headline = soup.find("h2", class_="menutab_headline")
    content_root = headline.find_parent("div") if isinstance(headline, Tag) else soup
    sections: list[dict[str, str]] = []
    fields = parse_label_items(soup)

    if isinstance(headline, Tag):
        for box in headline.find_all_next("div", class_=re.compile(r"\bbox(Standard|NoBorder)\b")):
            title_node = box.find(["h2", "h3", "h4", "legend"])
            if not isinstance(title_node, Tag):
                continue
            title = clean_text(title_node)
            if not title or title in {"Inhalte", "Semesterplanung", "Weitere Funktionen"}:
                continue
            text = clean_text(box)
            if title and text.startswith(title):
                text = clean_whitespace(text[len(title) :])
            if text:
                sections.append({"title": title, "text": text})

    if not sections and isinstance(content_root, Tag):
        full_text = clean_text(soup)
        if "Es wurden noch keine Inhalte hinterlegt." in full_text:
            sections.append(
                {
                    "title": "Inhalte",
                    "text": "Es wurden noch keine Inhalte hinterlegt.",
                }
            )
        else:
            text = clean_text(content_root)
            if text:
                sections.append({"title": "Inhalte", "text": text})

    unique_sections: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for section in sections:
        key = (section["title"], section["text"])
        if key not in seen:
            seen.add(key)
            unique_sections.append(section)

    return {
        "fields": fields,
        "sections": unique_sections,
    }


def parse_label_items(scope: Tag) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in scope.find_all("div", class_="labelItemLine"):
        label = line.find("label")
        answer = line.find("div", class_="answer")
        if not isinstance(label, Tag) or not isinstance(answer, Tag):
            continue
        key = clean_text(label).rstrip(":")
        value = clean_text(answer)
        if key and value:
            fields[key] = value
    return fields


def parse_appointment_tables(scope: Tag) -> list[dict[str, str]]:
    appointments: list[dict[str, str]] = []
    tables = scope.find_all("table", id=re.compile(r"appointmentSeriesTableTable$"))
    for table in tables:
        headers = [clean_text(header) for header in table.find_all("th")]
        body = table.find("tbody")
        if not isinstance(body, Tag):
            continue
        for row in body.find_all("tr", recursive=False):
            cells = row.find_all("td", recursive=False)
            record: dict[str, str] = {}
            for index, cell in enumerate(cells):
                key = headers[index] if index < len(headers) and headers[index] else f"column_{index}"
                value = clean_text(cell)
                if value:
                    record[key] = value
            if record:
                appointments.append(record)
    return appointments


def parse_module_categories(html_text: str) -> list[str]:
    """Extract the sorted, deduplicated module/study-program codes from the
    'Module / Studiengänge' table on a course detail page."""
    soup = BeautifulSoup(html_text, "html.parser")
    table = soup.find("table", id=re.compile(r"moduleAssignmentsTable$"))
    if not isinstance(table, Tag):
        return []
    body = table.find("tbody")
    if not isinstance(body, Tag):
        return []
    codes: set[str] = set()
    for row in body.find_all("tr", recursive=False):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 2:
            continue
        code = _module_assignment_code(clean_text(cells[0]), clean_text(cells[1]))
        if code:
            codes.add(code)
    return sorted(codes)


def _module_assignment_code(module_number: str, short_name: str) -> str | None:
    """Pick the readable code of one 'Module / Studiengänge' row.

    ALMA puts the code in the 'Modulnummer' column for some rows and in the
    'Modulname (Kurztext)' column for others; the remaining cell then holds a
    plain ordering number or the long 'NN|NNN|H|YYYY-CODE' form. The readable
    code is the value that is neither purely numeric nor the long form.
    """
    for value in (module_number, short_name):
        candidate = value.strip()
        if candidate and not candidate.isdigit() and "|" not in candidate:
            return candidate
    return None


def _module_table_is_paginated(html_text: str) -> bool:
    """Detect whether the module table shows only the first of several pages."""
    soup = BeautifulSoup(html_text, "html.parser")
    page_text = soup.find("span", class_="dataScrollerPageText")
    if not isinstance(page_text, Tag):
        return False
    match = re.search(r"von\s+(\d+)", clean_text(page_text))
    return bool(match and int(match.group(1)) > 1)


def first(values: list[str] | None) -> str | None:
    if not values:
        return None
    return values[0]


def unique_courses(courses: list[CatalogNode]) -> list[CatalogNode]:
    unique: dict[tuple[str | None, str | None, str | None], CatalogNode] = {}
    for course in courses:
        key = (course.unit_id, course.period_id, course.detail_url)
        if key not in unique:
            unique[key] = course
    return list(unique.values())


def parse_versioned_title(title: str) -> tuple[str, int] | None:
    match = re.search(r"\(?\bVersion\s+(\d{4})\)?", title, flags=re.I)
    if not match:
        return None
    year = int(match.group(1))
    base = clean_whitespace(
        re.sub(r"\s*\(?\bVersion\s+\d{4}\)?", "", title, flags=re.I)
    )
    return base, year


def catalog_path_from_url(url: str | None) -> str | None:
    if not url:
        return None
    query = parse_qs(urlparse(html.unescape(url)).query)
    path = first(query.get("path"))
    if not path:
        return None
    return path


def clean_text(node: Tag | Any) -> str:
    if node is None:
        return ""
    if isinstance(node, Tag):
        return clean_whitespace(node.get_text(" ", strip=True))
    return clean_whitespace(str(node))


def clean_whitespace(value: str) -> str:
    value = re.sub(r"\[Sortierbare Spalte\]", "", value)
    return repair_mojibake(re.sub(r"\s+", " ", html.unescape(value)).strip())


def repair_mojibake(value: str | None) -> str:
    if value is None:
        return ""
    if "\u0102" in value:
        try:
            return value.encode("cp1250").decode("utf-8")
        except UnicodeError:
            return value
    if "\u00c3" in value or "\u00c2" in value:
        try:
            return value.encode("latin-1").decode("utf-8")
        except UnicodeError:
            return value
    if "Ã" not in value and "Â" not in value:
        return value
    try:
        return value.encode("latin-1").decode("utf-8")
    except UnicodeError:
        return value
