from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from db.d1 import D1ExecutionError, fetch_all, fetch_one

CATALOG_FILTER_SQL = """
    (
        c.organisation LIKE '%Fachbereich Informatik%'
        OR c.number LIKE 'INF%'
        OR c.number LIKE 'INFO%'
        OR c.number LIKE 'INFM%'
        OR c.number LIKE 'INFL%'
    )
"""

MASTER_CAT_ORDER = ["TECH", "THEO", "PRAK", "INFO", "BASIS"]
PREREQUISITE_KEYWORDS = ("voraus", "prerequisite", "requirement")
DESCRIPTION_SECTION_KEYWORDS = (
    "beschreibung",
    "description",
    "inhalt",
    "content",
    "lernziele",
    "learning",
    "kommentar",
    "comment",
    "empfehlung",
)
# ALMA renders the active "Inhalte" tab with the page's tab bar plus the heading
# repeated three times before the real text, e.g. "Semesterplanung Termine
# Inhalte ... Module / Studiengänge Inhalte Inhalte Inhalte <real text>".
INHALTE_NAV_MARKER = "Inhalte Inhalte Inhalte"
# Empty sections carry this placeholder instead of real content.
INHALTE_EMPTY_PLACEHOLDER = "es wurden noch keine inhalte hinterlegt"
# The syllabus box is titled exactly "Inhalte"; its embedded links feed contentsLinks.
INHALTE_SECTION_TITLE = "inhalte"
# German course texts use "LP" (Leistungspunkte) as a synonym for ECTS.
ECTS_TEXT_PATTERN = re.compile(r'(?<!\d)(\d+(?:[.,]\d+)?)\s*(?:cp|ects|lp)\b', re.IGNORECASE)
# ALMA period labels look like "Sommer 2026" or "Winter 2025/26".
PERIOD_LABEL_PATTERN = re.compile(r"^(Sommer|Winter)\s+(\d{4})", re.IGNORECASE)
EXAM_SLOT_PATTERN = re.compile(r"\b(klausur|nachklausur|pruefung|prüfung|exam|resit)\b", re.IGNORECASE)
RESIT_SLOT_PATTERN = re.compile(r"\b(nachklausur|resit)\b", re.IGNORECASE)
# The label only exists inside the scraped course payload, so read it from raw_json.
PERIOD_LABEL_SQL = "COALESCE(json_extract(c.raw_json, '$.period_label'), c.period_id)"
# Course numbers are unique and stable across ALMA periods, so they identify the
# same course in different semesters; unit_id is the fallback for unnumbered rows.
COURSE_KEY_SQL = "COALESCE(c.number, c.unit_id)"
ALL_PERIODS_KEYWORD = "all"


def _placeholders(count: int) -> str:
    return ", ".join("?" for _ in range(count))


def _safe_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_ects(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalize_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _unique_preserve_order(values: list[str]) -> list[str]:
    unique_values: list[str] = []
    seen_values: set[str] = set()
    for value in values:
        normalized_value = value.strip()
        if not normalized_value or normalized_value in seen_values:
            continue
        unique_values.append(normalized_value)
        seen_values.add(normalized_value)
    return unique_values


def _extract_ects_from_text(value: str | None) -> float | None:
    if not value:
        return None

    match = ECTS_TEXT_PATTERN.search(value)
    if not match:
        return None

    return _normalize_ects(match.group(1).replace(',', '.'))


def _is_ects_only_text(value: str | None) -> bool:
    if not value:
        return False

    remainder = ECTS_TEXT_PATTERN.sub("", value).strip(" \t\r\n.,;:-()/")
    return not remainder


def _strip_repeated_section_title(section_title: str, section_text: str) -> str:
    normalized_title = section_title.strip()
    normalized_text = section_text.strip()
    if not normalized_title:
        return normalized_text

    if normalized_text.casefold().startswith(normalized_title.casefold()):
        return normalized_text[len(normalized_title):].lstrip(" \t\r\n.,;:-")
    return normalized_text


def _decode_text_links(value: Any) -> list[dict[str, str]]:
    if value is None:
        return []
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
    else:
        parsed = value
    if not isinstance(parsed, list):
        return []

    links: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for item in parsed:
        if not isinstance(item, dict):
            continue
        url = _safe_text(item.get("url"))
        if not url:
            continue
        label = _safe_text(item.get("label")) or url
        key = (label.casefold(), url)
        if key in seen:
            continue
        seen.add(key)
        links.append({"label": label, "url": url})
    return links


def _normalize_content_section(row: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(row)
    normalized["links"] = _decode_text_links(row.get("linksJson") or row.get("links_json"))
    normalized.pop("linksJson", None)
    normalized.pop("links_json", None)
    return normalized


def _escape_like_search_term(value: str) -> str:
    return value.replace('^', '^^').replace('%', '^%').replace('_', '^_')


def _build_search_terms(value: str) -> list[str]:
    raw_terms = [term.strip('.,:;()[]{}') for term in value.split()]
    filtered_terms = [term for term in raw_terms if len(term) > 1]
    return _unique_preserve_order(filtered_terms[:6] or [value])


def _group_rows_by_course_id(rows: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    grouped_rows: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        course_id = row.get("courseId")
        if course_id is None:
            continue
        grouped_rows.setdefault(int(course_id), []).append(row)
    return grouped_rows


def _study_area_to_master_cat(study_area_code: str | None) -> str | None:
    if not study_area_code:
        return None

    normalized_code = study_area_code.upper()
    if normalized_code.endswith("TECH"):
        return "TECH"
    if normalized_code.endswith("THEO"):
        return "THEO"
    if normalized_code.endswith("PRAK"):
        return "PRAK"
    if normalized_code in {"INFO", "INFO-INFO", "ML-CS"} or normalized_code.endswith("-INFO"):
        return "INFO"
    if normalized_code in {"INFO-FOKUS", "ML-DIVERSE", "ML-EXP", "PROSEM", "UEBK"}:
        return "BASIS"
    if normalized_code in {"MATH", "INF", "INFO-BASIS", "ML-FOUND"} or normalized_code.endswith(
        "BASIS"
    ):
        return "BASIS"
    return None


def _normalize_master_cats(option_rows: list[dict[str, Any]]) -> list[str]:
    discovered_categories: list[str] = []
    for row in option_rows:
        category = _study_area_to_master_cat(_safe_text(row.get("studyAreaCode")))
        if category:
            discovered_categories.append(category)

    unique_categories = _unique_preserve_order(discovered_categories)
    return sorted(unique_categories, key=lambda category: MASTER_CAT_ORDER.index(category))


def _appointment_context(row: dict[str, Any]) -> str:
    return " ".join(
        value
        for value in [
            _safe_text(row.get("groupTitle")),
            _safe_text(row.get("groupType")),
            _safe_text(row.get("timeNote")),
            _safe_text(row.get("note")),
        ]
        if value
    )


def _appointment_slot_type(row: dict[str, Any]) -> str:
    context = _appointment_context(row)
    if RESIT_SLOT_PATTERN.search(context):
        return "Nachklausur"
    if EXAM_SLOT_PATTERN.search(context):
        return "Klausur"
    return _safe_text(row.get("groupType")) or _safe_text(row.get("courseType")) or "Course"


def _build_schedule(appointment_rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    schedule: list[dict[str, str]] = []

    for row in appointment_rows:
        day = _safe_text(row.get("weekday")) or _safe_text(row.get("dateText")) or "TBA"
        time_text = _safe_text(row.get("timeText")) or "TBA"
        room_text = _safe_text(row.get("roomText")) or "TBA"
        slot_type = _appointment_slot_type(row)

        schedule.append(
            {
                "day": day,
                "time": time_text,
                "room": room_text,
                "type": slot_type,
            }
        )

    return schedule


def _build_regulation_options(option_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    seen_options: set[tuple[str, str, str, str]] = set()

    for row in option_rows:
        program_code = _safe_text(row.get("programCode"))
        study_area_code = _safe_text(row.get("studyAreaCode"))
        option_status = _safe_text(row.get("optionStatus")) or "allowed"
        module_code = _safe_text(row.get("moduleCode")) or ""
        option_key = (
            program_code or "",
            study_area_code or "",
            option_status,
            module_code,
        )
        if option_key in seen_options:
            continue
        seen_options.add(option_key)

        options.append(
            {
                "programCode": program_code,
                "programName": _safe_text(row.get("programName")),
                "studyAreaCode": study_area_code,
                "studyAreaName": _safe_text(row.get("studyAreaName")),
                "areaType": _safe_text(row.get("areaType")),
                "optionStatus": option_status,
                "ectsCounted": _normalize_ects(row.get("ectsCounted")),
                "moduleCode": module_code or None,
                "moduleTitle": _safe_text(row.get("moduleTitle")),
            }
        )

    return options


def _extract_prerequisites(content_sections: list[dict[str, Any]]) -> list[str]:
    extracted_prerequisites: list[str] = []
    for section in content_sections:
        section_title = (_safe_text(section.get("title")) or "").lower()
        if not any(keyword in section_title for keyword in PREREQUISITE_KEYWORDS):
            continue

        section_text = _safe_text(section.get("text"))
        if not section_text:
            continue

        lines = [line.strip("•- \t") for line in section_text.splitlines() if line.strip()]
        extracted_prerequisites.extend(lines or [section_text])

    return _unique_preserve_order(extracted_prerequisites)


def _pick_description_entry(
    short_comment: str | None,
    content_sections: list[dict[str, Any]],
) -> dict[str, Any]:
    normalized_short_comment = _safe_text(short_comment)
    if normalized_short_comment and not _is_ects_only_text(normalized_short_comment):
        return {"text": normalized_short_comment, "links": []}

    for section in content_sections:
        section_title = _safe_text(section.get("title")) or ""
        if not any(keyword in section_title.lower() for keyword in DESCRIPTION_SECTION_KEYWORDS):
            continue
        section_text = _safe_text(section.get("text"))
        if section_text:
            return {
                "text": _strip_repeated_section_title(section_title, section_text),
                "links": _decode_text_links(section.get("links")),
            }

    for section in content_sections:
        section_title = _safe_text(section.get("title")) or ""
        section_text = _safe_text(section.get("text"))
        if section_text:
            return {
                "text": _strip_repeated_section_title(section_title, section_text),
                "links": _decode_text_links(section.get("links")),
            }

    return {"text": normalized_short_comment or "", "links": []}


def _pick_description(short_comment: str | None, content_sections: list[dict[str, Any]]) -> str:
    return str(_pick_description_entry(short_comment, content_sections)["text"])


def _clean_section_text(text: str) -> str | None:
    """Strip ALMA's scraped tab-navigation chrome from a content section.

    Unstructured "Inhalte" sections carry the page's tab bar before the real
    text, which follows the repeated-heading marker; everything before it is
    chrome. Returns None when nothing meaningful remains.
    """
    marker_index = text.find(INHALTE_NAV_MARKER)
    if marker_index != -1:
        text = text[marker_index + len(INHALTE_NAV_MARKER):]

    cleaned = text.strip()
    if not cleaned or INHALTE_EMPTY_PLACEHOLDER in cleaned.lower():
        return None
    return cleaned


def _strip_leading_title(title: str, text: str) -> str:
    """Drop a heading that the scraper duplicated as the first words of the body.

    Labelled boxes store their text as "<title> <body>" (e.g. title "Lernziele",
    text "Lernziele ..."); the title is shown separately, so trim the repeat.
    """
    if title and text.lower().startswith(title.lower()):
        return text[len(title):].lstrip(" \t:–—-")
    return text


def _build_content_sections(
    content_sections: list[dict[str, Any]],
    description: str,
) -> list[dict[str, Any]]:
    """Return the ALMA "Inhalte" tab content as ordered title/text/links blocks.

    ALMA stores structured courses as labelled sub-boxes (Lernziele,
    Qualifikationsziel, ...) and unstructured ones as a single "Inhalte" blob;
    both shapes land in ``content_sections``. Surface every block with real
    text, minus what other detail fields already show — the description (shown
    verbatim) and the prerequisites (their own section) — so nothing repeats.
    Each block keeps its embedded links so the client can render them inline.
    """
    blocks: list[dict[str, Any]] = []
    for section in content_sections:
        section_title = _safe_text(section.get("title")) or ""
        section_text = _safe_text(section.get("text"))
        if not section_text:
            continue
        # Prerequisites have their own detail section.
        if any(keyword in section_title.lower() for keyword in PREREQUISITE_KEYWORDS):
            continue
        # The description already surfaces this exact text.
        if section_text == description:
            continue
        cleaned = _clean_section_text(section_text)
        if not cleaned:
            continue
        blocks.append(
            {
                "title": section_title,
                "text": _strip_leading_title(section_title, cleaned),
                "links": _decode_text_links(section.get("links")),
            }
        )
    return blocks


def _extract_contents_links(content_sections: list[dict[str, Any]]) -> list[dict[str, str]]:
    for section in content_sections:
        section_title = (_safe_text(section.get("title")) or "").strip().lower()
        if section_title != INHALTE_SECTION_TITLE:
            continue
        section_text = _safe_text(section.get("text"))
        if not section_text or not _clean_section_text(section_text):
            continue
        return _decode_text_links(section.get("links"))
    return []


def _period_sort_key(period_label: str) -> tuple[int, int, str]:
    """Chronological key: within a year the summer term starts before the winter term."""
    match = PERIOD_LABEL_PATTERN.match(period_label)
    if not match:
        return (0, 0, period_label)
    season_rank = 0 if match.group(1).lower() == "sommer" else 1
    return (int(match.group(2)), season_rank, period_label)


async def list_catalog_periods(env: Any) -> list[dict[str, Any]]:
    """Return the semesters present in the catalog, newest first."""
    rows = await fetch_all(
        env,
        f"""
        SELECT
            c.period_id AS periodId,
            MAX({PERIOD_LABEL_SQL}) AS periodLabel,
            COUNT(*) AS courseCount
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
        GROUP BY c.period_id
        """,
    )

    periods = [
        {
            "periodId": str(row["periodId"]),
            "label": _safe_text(row.get("periodLabel")) or str(row["periodId"]),
            "courseCount": int(row.get("courseCount") or 0),
        }
        for row in rows
        if row.get("periodId") is not None
    ]
    periods.sort(key=lambda period: _period_sort_key(period["label"]), reverse=True)
    return periods


def _derive_term_type(period_labels: list[str]) -> str:
    """Classify a course as a summer-term, winter-term, or both-terms offering."""
    has_summer = False
    has_winter = False
    for label in period_labels:
        match = PERIOD_LABEL_PATTERN.match(label)
        if not match:
            continue
        if match.group(1).lower() == "sommer":
            has_summer = True
        else:
            has_winter = True

    if has_summer and has_winter:
        return "both"
    if has_summer:
        return "summer"
    if has_winter:
        return "winter"
    return "unknown"


def _collect_offering_groups(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group per-period course rows into one entry per distinct course.

    Preserves the incoming row order for the result, picks the row from the
    newest period as the representative, and collects the full offering history.
    """
    groups: dict[str, dict[str, Any]] = {}
    ordered_keys: list[str] = []

    for row in rows:
        if row.get("id") is None:
            continue
        course_key = _safe_text(row.get("courseKey")) or str(row["id"])
        period_label = _safe_text(row.get("periodLabel")) or ""
        sort_key = _period_sort_key(period_label)

        group = groups.get(course_key)
        if group is None:
            group = {
                "courseKey": course_key,
                "representativeId": int(row["id"]),
                "representativeSortKey": sort_key,
                "offeredPeriods": [],
            }
            groups[course_key] = group
            ordered_keys.append(course_key)
        elif sort_key > group["representativeSortKey"]:
            group["representativeId"] = int(row["id"])
            group["representativeSortKey"] = sort_key

        if period_label and period_label not in group["offeredPeriods"]:
            group["offeredPeriods"].append(period_label)

    for group in groups.values():
        group["offeredPeriods"].sort(key=_period_sort_key, reverse=True)
        del group["representativeSortKey"]

    return [groups[key] for key in ordered_keys]


def _build_search_where(search_terms: list[str]) -> tuple[str, list[str]]:
    clauses: list[str] = []
    params: list[str] = []
    for term in search_terms:
        like_value = f"%{_escape_like_search_term(term)}%"
        clauses.append(
            """
            (
                COALESCE(c.number, '') LIKE ? ESCAPE '^'
                OR c.title LIKE ? ESCAPE '^'
                OR COALESCE(c.organisation, '') LIKE ? ESCAPE '^'
                OR EXISTS (
                    SELECT 1
                    FROM course_lecturers AS cl
                    JOIN lecturers AS l ON l.id = cl.lecturer_id
                    WHERE cl.course_id = c.id
                      AND (
                        COALESCE(l.display_name, '') LIKE ? ESCAPE '^'
                        OR COALESCE(l.name, '') LIKE ? ESCAPE '^'
                      )
                )
            )
            """
        )
        params.extend([like_value, like_value, like_value, like_value, like_value])
    return "\n          AND ".join(clauses), params


async def _resolve_period_id(env: Any, period_id: str | None) -> str | None:
    requested_period = _safe_text(period_id)
    if requested_period:
        return requested_period

    periods = await list_catalog_periods(env)
    return periods[0]["periodId"] if periods else None


_D1_CHUNK_SIZE = 80


async def _load_catalog_related_chunk(
    env: Any,
    chunk: list[int],
) -> tuple[
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
    list[dict[str, Any]],
]:
    placeholders = _placeholders(len(chunk))

    # Module matches sort first (matchRank 0); direct study-area links are fetched
    # separately because D1 is more reliable without a UNION in the hot catalog path.
    curriculum_option_sql = f"""
        SELECT
            m.course_id AS courseId,
            cm.module_code AS moduleCode,
            cm.title AS moduleTitle,
            cm.ects AS moduleEcts,
            sp.code AS programCode,
            sp.name AS programName,
            sa.code AS studyAreaCode,
            sa.name AS studyAreaName,
            sa.area_type AS areaType,
            opt.status AS optionStatus,
            opt.ects_counted AS ectsCounted,
            0 AS matchRank,
            sa.sort_order AS areaSortOrder
        FROM course_curriculum_matches AS m
        JOIN curriculum_modules AS cm ON cm.id = m.module_id
        LEFT JOIN module_study_area_options AS opt ON opt.module_id = cm.id
        LEFT JOIN study_areas AS sa ON sa.id = opt.study_area_id
        LEFT JOIN study_programs AS sp ON sp.id = sa.program_id
        WHERE m.course_id IN ({placeholders})
    """
    study_area_link_sql = f"""
        SELECT
            l.course_id AS courseId,
            NULL AS moduleCode,
            NULL AS moduleTitle,
            NULL AS moduleEcts,
            sp.code AS programCode,
            sp.name AS programName,
            sa.code AS studyAreaCode,
            sa.name AS studyAreaName,
            sa.area_type AS areaType,
            'allowed' AS optionStatus,
            NULL AS ectsCounted,
            1 AS matchRank,
            sa.sort_order AS areaSortOrder
        FROM course_study_area_links AS l
        JOIN study_areas AS sa ON sa.id = l.study_area_id
        JOIN study_programs AS sp ON sp.id = sa.program_id
        WHERE l.course_id IN ({placeholders})
    """

    lecturer_rows, parallel_group_rows, appointment_rows, curriculum_rows, link_rows = await asyncio.gather(
        fetch_all(
            env,
            f"""
        SELECT
            cl.course_id AS courseId,
            l.display_name AS displayName
        FROM course_lecturers AS cl
        JOIN lecturers AS l ON l.id = cl.lecturer_id
        WHERE cl.course_id IN ({placeholders})
        ORDER BY cl.course_id ASC, l.display_name ASC
        """,
            chunk,
        ),
        fetch_all(
            env,
            f"""
        SELECT
            course_id AS courseId,
            group_type AS groupType,
            language,
            semester_hours AS semesterHours
        FROM parallel_groups
        WHERE course_id IN ({placeholders})
        ORDER BY course_id ASC, position ASC
        """,
            chunk,
        ),
        fetch_all(
            env,
            f"""
        SELECT
            pg.course_id AS courseId,
            pg.title AS groupTitle,
            pg.group_type AS groupType,
            c.course_type AS courseType,
            a.weekday,
            a.weekday_index AS weekdayIndex,
            a.time_text AS timeText,
            a.date_text AS dateText,
            a.start_time AS startTime,
            a.room_text AS roomText,
            a.time_note AS timeNote,
            a.note,
            a.position
        FROM appointments AS a
        JOIN parallel_groups AS pg ON pg.id = a.parallel_group_id
        JOIN courses AS c ON c.id = pg.course_id
        WHERE pg.course_id IN ({placeholders})
        ORDER BY
            pg.course_id ASC,
            CASE WHEN a.weekday_index IS NULL THEN 99 ELSE a.weekday_index END ASC,
            COALESCE(a.start_time, '99:99') ASC,
            a.position ASC
        """,
            chunk,
        ),
        fetch_all(env, curriculum_option_sql, chunk),
        fetch_all(env, study_area_link_sql, chunk),
    )

    option_rows = sorted(
        [*curriculum_rows, *link_rows],
        key=lambda row: (
            int(row["courseId"]),
            int(row.get("matchRank") or 0),
            str(row.get("programCode") or ""),
            int(row.get("areaSortOrder") or 0),
            str(row.get("studyAreaName") or ""),
        ),
    )

    return lecturer_rows, parallel_group_rows, appointment_rows, option_rows


async def _load_catalog_related(
    env: Any,
    course_ids: list[int],
) -> tuple[
    dict[int, list[dict[str, Any]]],
    dict[int, list[dict[str, Any]]],
    dict[int, list[dict[str, Any]]],
    dict[int, list[dict[str, Any]]],
]:
    if not course_ids:
        return {}, {}, {}, {}

    all_lecturers: list[dict[str, Any]] = []
    all_groups: list[dict[str, Any]] = []
    all_appointments: list[dict[str, Any]] = []
    all_options: list[dict[str, Any]] = []

    for i in range(0, len(course_ids), _D1_CHUNK_SIZE):
        chunk = course_ids[i : i + _D1_CHUNK_SIZE]
        lec, grp, apt, opt = await _load_catalog_related_chunk(env, chunk)
        all_lecturers.extend(lec)
        all_groups.extend(grp)
        all_appointments.extend(apt)
        all_options.extend(opt)

    return (
        _group_rows_by_course_id(all_lecturers),
        _group_rows_by_course_id(all_groups),
        _group_rows_by_course_id(all_appointments),
        _group_rows_by_course_id(all_options),
    )


def _build_catalog_summary(
    course: dict[str, Any],
    lecturer_rows: list[dict[str, Any]],
    parallel_group_rows: list[dict[str, Any]],
    appointment_rows: list[dict[str, Any]],
    option_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    lecturer_names = _unique_preserve_order(
        [
            name
            for row in lecturer_rows
            if (name := _safe_text(row.get("displayName")))
        ]
    )
    schedule = _build_schedule(appointment_rows)
    types = _unique_preserve_order(
        [
            value
            for value in [
                _safe_text(course.get("courseType")),
                *[_safe_text(row.get("groupType")) for row in parallel_group_rows],
            ]
            if value
        ]
    )
    language = next(
        (
            language_value
            for row in parallel_group_rows
            if (language_value := _safe_text(row.get("language")))
        ),
        None,
    )
    regulation_options = _build_regulation_options(option_rows)
    first_matching_row = option_rows[0] if option_rows else {}
    ects = next(
        (
            ects_value
            for row in option_rows
            if (ects_value := _normalize_ects(row.get("moduleEcts"))) is not None
        ),
        None,
    ) or _extract_ects_from_text(_safe_text(course.get("shortComment")))
    first_slot = schedule[0] if schedule else None

    return {
        "id": str(course["id"]),
        "numericId": int(course["id"]),
        "number": _safe_text(course.get("number")) or _safe_text(course.get("courseKey")) or "",
        "title": _safe_text(course.get("title")) or "Untitled course",
        "periodId": _safe_text(course.get("periodId")),
        "periodLabel": _safe_text(course.get("periodLabel")),
        "lecturer": ", ".join(lecturer_names),
        "lecturers": lecturer_names,
        "room": first_slot["room"] if first_slot else "TBA",
        "types": types,
        "ects": ects,
        "sws": _normalize_ects(course.get("semesterHours")),
        "masterCats": _normalize_master_cats(option_rows),
        "studyAreaOptions": regulation_options,
        "weekdays": _unique_preserve_order([slot["day"] for slot in schedule]),
        "schedule": schedule,
        "frequency": _safe_text(course.get("offeringFrequency")) or "Unknown",
        "language": language or "Unknown",
        "prerequisites": [],
        "description": _safe_text(course.get("shortComment")) or "",
        "exams": [],
        "registrationPeriod": _safe_text(course.get("registrationPeriod")) or "",
        "detailUrl": _safe_text(course.get("detailUrl")) or "",
        "detailPageUrl": _safe_text(course.get("detailPageUrl")) or "",
        "organisation": _safe_text(course.get("organisation")) or "",
        "courseType": _safe_text(course.get("courseType")) or "",
        "shortComment": _safe_text(course.get("shortComment")) or "",
        "moduleCode": _safe_text(first_matching_row.get("moduleCode")),
        "moduleTitle": _safe_text(first_matching_row.get("moduleTitle")),
        "hasRegulationMapping": bool(regulation_options),
    }


async def _fetch_catalog_courses_by_ids(env: Any, course_ids: list[int]) -> list[dict[str, Any]]:
    courses: list[dict[str, Any]] = []
    for i in range(0, len(course_ids), _D1_CHUNK_SIZE):
        chunk = course_ids[i : i + _D1_CHUNK_SIZE]
        rows = await fetch_all(
            env,
            f"""
            SELECT
                c.id,
                c.number,
                {COURSE_KEY_SQL} AS courseKey,
                c.title,
                c.organisation,
                c.course_type AS courseType,
                c.offering_frequency AS offeringFrequency,
                c.registration_period AS registrationPeriod,
                c.short_comment AS shortComment,
                c.semester_hours AS semesterHours,
                c.detail_url AS detailUrl,
                c.detail_page_url AS detailPageUrl,
                c.period_id AS periodId,
                {PERIOD_LABEL_SQL} AS periodLabel
            FROM courses AS c
            WHERE c.id IN ({_placeholders(len(chunk))})
            """,
            chunk,
        )
        courses.extend(rows)
    return courses


async def _list_all_catalog_courses(
    env: Any,
    limit: int,
    search: str | None,
) -> list[dict[str, Any]]:
    """Return the deduplicated multi-period catalog with offering history."""
    safe_limit = max(1, min(limit, 1000))
    params: list[Any] = []
    sql = f"""
        SELECT
            c.id,
            {COURSE_KEY_SQL} AS courseKey,
            {PERIOD_LABEL_SQL} AS periodLabel
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
    """

    normalized_search = _safe_text(search)
    if normalized_search:
        where_clause, where_params = _build_search_where(_build_search_terms(normalized_search))
        sql += "\n          AND " + where_clause
        params.extend(where_params)

    sql += "\n        ORDER BY c.title ASC, c.id ASC"

    rows = await fetch_all(env, sql, params)
    groups = _collect_offering_groups(rows)[:safe_limit]
    representative_ids = [group["representativeId"] for group in groups]

    courses = await _fetch_catalog_courses_by_ids(env, representative_ids)
    courses_by_id = {int(course["id"]): course for course in courses}
    lecturers_by_course, groups_by_course, appointments_by_course, options_by_course = (
        await _load_catalog_related(env, representative_ids)
    )

    summaries: list[dict[str, Any]] = []
    for group in groups:
        course = courses_by_id.get(group["representativeId"])
        if course is None:
            continue
        course_id = int(course["id"])
        summary = _build_catalog_summary(
            course,
            lecturers_by_course.get(course_id, []),
            groups_by_course.get(course_id, []),
            appointments_by_course.get(course_id, []),
            options_by_course.get(course_id, []),
        )
        summary["offeredPeriods"] = group["offeredPeriods"]
        summary["termType"] = _derive_term_type(group["offeredPeriods"])
        summaries.append(summary)

    return summaries


async def list_catalog_courses(
    env: Any,
    limit: int = 100,
    search: str | None = None,
    period_id: str | None = None,
) -> list[dict[str, Any]]:
    requested_period = _safe_text(period_id)
    if requested_period and requested_period.lower() == ALL_PERIODS_KEYWORD:
        return await _list_all_catalog_courses(env, limit=limit, search=search)

    safe_limit = max(1, min(limit, 500))
    # Without a period filter the multi-semester catalog would repeat every course
    # once per semester, so default to the most recent period.
    resolved_period_id = await _resolve_period_id(env, period_id)
    params: list[Any] = []
    sql = f"""
        SELECT
            c.id,
            c.number,
            COALESCE(c.number, c.unit_id) AS courseKey,
            c.title,
            c.organisation,
            c.course_type AS courseType,
            c.offering_frequency AS offeringFrequency,
            c.registration_period AS registrationPeriod,
            c.short_comment AS shortComment,
            c.semester_hours AS semesterHours,
            c.detail_url AS detailUrl,
            c.detail_page_url AS detailPageUrl,
            c.period_id AS periodId,
            {PERIOD_LABEL_SQL} AS periodLabel
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
    """

    if resolved_period_id is not None:
        sql += "\n          AND c.period_id = ?"
        params.append(resolved_period_id)

    normalized_search = _safe_text(search)
    if normalized_search:
        search_terms = _build_search_terms(normalized_search)
        term_filters: list[str] = []

        for term in search_terms:
            like_value = f"%{_escape_like_search_term(term)}%"
            term_filters.append(
                """
                (
                    COALESCE(c.number, '') LIKE ? ESCAPE '^'
                    OR c.title LIKE ? ESCAPE '^'
                    OR COALESCE(c.organisation, '') LIKE ? ESCAPE '^'
                )
                """
            )
            params.extend([like_value, like_value, like_value])

        sql += "\n          AND " + "\n          AND ".join(term_filters)

        first_term_like_value = f"%{_escape_like_search_term(search_terms[0])}%"
        sql += """
            ORDER BY
                CASE
                    WHEN COALESCE(c.number, '') LIKE ? ESCAPE '^' THEN 0
                    WHEN c.title LIKE ? ESCAPE '^' THEN 1
                    WHEN COALESCE(c.organisation, '') LIKE ? ESCAPE '^' THEN 2
                    ELSE 3
                END ASC,
        """
        params.extend([
            first_term_like_value,
            first_term_like_value,
            first_term_like_value,
        ])
    else:
        sql += """
            ORDER BY
        """

    sql += """
            CASE
                WHEN c.number LIKE 'INFO%' THEN 0
                WHEN c.number LIKE 'INF%' THEN 1
                WHEN c.number LIKE 'INFM%' THEN 2
                WHEN c.number LIKE 'INFL%' THEN 3
                ELSE 4
            END ASC,
            COALESCE(c.number, c.unit_id) ASC,
            c.title ASC
        LIMIT ?
    """
    params.append(safe_limit)

    courses = await fetch_all(env, sql, params)
    course_ids = [int(course["id"]) for course in courses]
    lecturers_by_course, groups_by_course, appointments_by_course, options_by_course = (
        await _load_catalog_related(env, course_ids)
    )

    return [
        _build_catalog_summary(
            course,
            lecturers_by_course.get(int(course["id"]), []),
            groups_by_course.get(int(course["id"]), []),
            appointments_by_course.get(int(course["id"]), []),
            options_by_course.get(int(course["id"]), []),
        )
        for course in courses
    ]


async def _load_offering_history(env: Any, course_key: str | None) -> list[str]:
    if not course_key:
        return []
    rows = await fetch_all(
        env,
        f"""
        SELECT {PERIOD_LABEL_SQL} AS periodLabel
        FROM courses AS c
        WHERE {COURSE_KEY_SQL} = ?
        """,
        [course_key],
    )
    labels = _unique_preserve_order(
        [label for row in rows if (label := _safe_text(row.get("periodLabel")))]
    )
    labels.sort(key=_period_sort_key, reverse=True)
    return labels


def _dedupe_external_links(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        platform = _safe_text(row.get("platform"))
        url = _safe_text(row.get("url"))
        if not platform or not url:
            continue
        key = (platform.casefold(), url)
        if key in seen:
            continue
        seen.add(key)
        links.append(
            {
                "platform": platform,
                "url": url,
                "label": _safe_text(row.get("label")) or "",
            }
        )
    return links


async def _load_external_links(
    env: Any,
    course_id: int,
    course_number: str | None,
) -> list[dict[str, str]]:
    link_rows: list[dict[str, Any]] = []
    try:
        link_rows.extend(
            await fetch_all(
                env,
                """
                SELECT platform, url, label
                FROM course_learning_links
                WHERE course_id = ?
                ORDER BY platform ASC, COALESCE(confidence, 0) DESC, id ASC
                """,
                [course_id],
            )
        )
    except D1ExecutionError:
        # Newer link table may not exist in older local D1 snapshots.
        pass

    if not course_number:
        return _dedupe_external_links(link_rows)

    try:
        link_rows.extend(
            await fetch_all(
                env,
                """
                SELECT platform, url, label
                FROM course_external_links
                WHERE course_number = ?
                ORDER BY platform ASC
                """,
                [course_number],
            )
        )
    except D1ExecutionError:
        # The legacy links table ships ahead of its data; treat missing as empty.
        pass

    return _dedupe_external_links(link_rows)


def _build_participant_limits(parallel_groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    limits: list[dict[str, Any]] = []
    for group in parallel_groups:
        min_participants = _normalize_int(group.get("minParticipants"))
        max_participants = _normalize_int(group.get("maxParticipants"))
        if min_participants is None and max_participants is None:
            continue
        limits.append(
            {
                "parallelGroupId": str(group.get("id") or ""),
                "title": _safe_text(group.get("title")),
                "groupType": _safe_text(group.get("groupType")),
                "minParticipants": min_participants,
                "maxParticipants": max_participants,
            },
        )
    return limits


def _json_list(value: Any) -> list[str]:
    if not value:
        return []
    try:
        import json

        decoded = json.loads(str(value))
    except (TypeError, ValueError):
        return []
    if not isinstance(decoded, list):
        return []
    return [
        text
        for item in decoded
        if (text := _safe_text(item))
    ]


async def _load_illias_metadata(env: Any, course_id: int) -> dict[str, Any] | None:
    try:
        row = await fetch_one(
            env,
            """
            SELECT
                ic.ref_id AS refId,
                ic.title,
                ic.url,
                ic.description,
                ic.availability,
                ic.registration,
                ic.deadline,
                ic.max_participants AS maxParticipants,
                ic.tags_json AS tagsJson,
                ic.instructors_json AS instructorsJson,
                m.confidence,
                m.match_type AS matchType,
                m.notes
            FROM illias_alma_matches AS m
            JOIN illias_courses AS ic ON ic.ref_id = m.illias_course_ref_id
            WHERE m.alma_course_id = ?
            ORDER BY m.confidence DESC, ic.title ASC
            LIMIT 1
            """,
            [course_id],
        )
    except D1ExecutionError as exc:
        message = str(exc).lower()
        if "no such table" not in message or "illias_" not in message:
            raise
        return None

    if row is None:
        return None

    url = _safe_text(row.get("url"))
    if not url:
        return None

    return {
        "refId": _safe_text(row.get("refId")) or "",
        "title": _safe_text(row.get("title")) or "",
        "url": url,
        "description": _safe_text(row.get("description")),
        "availability": _safe_text(row.get("availability")),
        "registration": _safe_text(row.get("registration")),
        "deadline": _safe_text(row.get("deadline")),
        "maxParticipants": row.get("maxParticipants"),
        "instructors": _json_list(row.get("instructorsJson")),
        "tags": _json_list(row.get("tagsJson")),
        "match": {
            "confidence": _normalize_ects(row.get("confidence")) or 0,
            "type": _safe_text(row.get("matchType")) or "",
            "notes": _safe_text(row.get("notes")) or "",
        },
    }


async def _resolve_newest_course_id(env: Any, course_id: int) -> int:
    """Map a catalog course id to the newest period row for the same number."""
    row = await fetch_one(
        env,
        f"""
        SELECT c.number, {PERIOD_LABEL_SQL} AS periodLabel
        FROM courses AS c
        WHERE c.id = ?
        LIMIT 1
        """,
        [course_id],
    )
    if row is None:
        return course_id

    number = _safe_text(row.get("number"))
    if not number:
        return course_id

    candidates = await fetch_all(
        env,
        f"""
        SELECT c.id, {PERIOD_LABEL_SQL} AS periodLabel
        FROM courses AS c
        WHERE c.number = ?
          AND {CATALOG_FILTER_SQL}
        """,
        [number],
    )
    if not candidates:
        return course_id

    newest = max(
        candidates,
        key=lambda candidate: _period_sort_key(_safe_text(candidate.get("periodLabel")) or ""),
    )
    return int(newest["id"])


async def get_catalog_course_detail(env: Any, course_id: int) -> dict[str, Any] | None:
    resolved_course_id = await _resolve_newest_course_id(env, course_id)
    raw_detail = await get_course_detail(env, resolved_course_id)
    if raw_detail is None:
        return None

    course = raw_detail["course"]
    course_id_value = int(course["id"])
    lecturers_by_course, groups_by_course, appointments_by_course, options_by_course = (
        await _load_catalog_related(env, [course_id_value])
    )
    content_sections = raw_detail["contentSections"]
    summary = _build_catalog_summary(
        course,
        lecturers_by_course.get(course_id_value, []),
        groups_by_course.get(course_id_value, []),
        appointments_by_course.get(course_id_value, []),
        options_by_course.get(course_id_value, []),
    )

    offered_periods = await _load_offering_history(env, summary.get("number") or None)
    description_entry = _pick_description_entry(summary.get("shortComment"), content_sections)
    contents = _build_content_sections(content_sections, description_entry["text"])
    external_links = await _load_external_links(
        env,
        course_id_value,
        _safe_text(course.get("number")),
    )
    illias_metadata = await _load_illias_metadata(env, course_id_value)
    if illias_metadata and not any(
        (_safe_text(link.get("platform")) or "").lower() == "ilias"
        for link in external_links
    ):
        external_links.append(
            {
                "platform": "ilias",
                "url": illias_metadata["url"],
                "label": "Open ILIAS course",
            }
        )
    summary.update(
        {
            "offeredPeriods": offered_periods,
            "termType": _derive_term_type(offered_periods),
            "externalLinks": external_links,
            "illias": illias_metadata,
            "participantLimits": _build_participant_limits(raw_detail["parallelGroups"]),
            "description": description_entry["text"],
            "descriptionLinks": description_entry["links"],
            "contents": contents,
            "contentsLinks": _extract_contents_links(content_sections) if contents else [],
            "prerequisites": _extract_prerequisites(content_sections),
            "exams": [
                {
                    "type": _safe_text(row.get("sourceTitle"))
                    or _safe_text(row.get("kind"))
                    or "Assessment",
                    "date": _safe_text(row.get("dateValue")) or "",
                    "duration": "–",
                }
                for row in raw_detail["assessmentDates"]
            ],
            "contentSections": content_sections,
            "courseFields": raw_detail["courseFields"],
            "rawLecturers": raw_detail["lecturers"],
            "parallelGroups": raw_detail["parallelGroups"],
            "appointments": raw_detail["appointments"],
            "assessmentDates": raw_detail["assessmentDates"],
        }
    )
    return summary


async def list_courses(env: Any, limit: int = 50) -> list[dict[str, Any]]:
    """Return a lightweight public course list from D1."""
    safe_limit = max(1, min(limit, 200))
    sql = """
        SELECT
            id,
            run_id AS runId,
            unit_id AS unitId,
            period_id AS periodId,
            COALESCE(number, unit_id) AS courseKey,
            number,
            title,
            catalog_title AS catalogTitle,
            organisation,
            course_type AS courseType,
            offering_frequency AS offeringFrequency,
            registration_period AS registrationPeriod,
            short_comment AS shortComment,
            semester_hours AS semesterHours,
            detail_url AS detailUrl,
            detail_page_url AS detailPageUrl
        FROM courses
        ORDER BY title ASC
        LIMIT ?
    """
    return await fetch_all(env, sql, [safe_limit])


async def get_course_detail(env: Any, course_id: int) -> dict[str, Any] | None:
    """Return one course plus its related records from D1."""
    course_sql = f"""
        SELECT
            c.id,
            c.run_id AS runId,
            c.node_id AS nodeId,
            c.unit_id AS unitId,
            c.period_id AS periodId,
            {PERIOD_LABEL_SQL} AS periodLabel,
            c.title,
            number,
            catalog_title AS catalogTitle,
            organisation,
            course_type AS courseType,
            offering_frequency AS offeringFrequency,
            registration_period AS registrationPeriod,
            short_comment AS shortComment,
            semester_hours AS semesterHours,
            detail_url AS detailUrl,
            detail_page_url AS detailPageUrl,
            raw_fields_json AS rawFieldsJson
        FROM courses AS c
        WHERE c.id = ?
        LIMIT 1
    """
    course = await fetch_one(env, course_sql, [course_id])
    if course is None:
        return None

    lecturers_sql = """
        SELECT
            l.id,
            l.display_name AS displayName,
            l.title,
            l.name,
            l.email,
            l.department,
            cl.source,
            cl.source_text AS sourceText
        FROM course_lecturers AS cl
        JOIN lecturers AS l ON l.id = cl.lecturer_id
        WHERE cl.course_id = ?
        ORDER BY l.display_name ASC
    """
    parallel_groups_sql = """
        SELECT
            id,
            position,
            title,
            group_type AS groupType,
            language,
            responsible_text AS responsibleText,
            max_participants AS maxParticipants,
            min_participants AS minParticipants,
            semester_hours AS semesterHours,
            raw_fields_json AS rawFieldsJson
        FROM parallel_groups
        WHERE course_id = ?
        ORDER BY position ASC
    """
    appointments_sql = """
        SELECT
            a.id,
            a.parallel_group_id AS parallelGroupId,
            pg.title AS groupTitle,
            pg.group_type AS groupType,
            c.course_type AS courseType,
            a.position,
            a.rhythm,
            a.weekday,
            a.weekday_index AS weekdayIndex,
            a.time_text AS timeText,
            a.start_time AS startTime,
            a.end_time AS endTime,
            a.time_note AS timeNote,
            a.date_text AS dateText,
            a.starts_on AS startsOn,
            a.ends_on AS endsOn,
            a.room_text AS roomText,
            a.instructors_text AS instructorsText,
            a.expected_participants AS expectedParticipants,
            a.note,
            a.cancellation_text AS cancellationText
        FROM appointments AS a
        JOIN parallel_groups AS pg ON pg.id = a.parallel_group_id
        JOIN courses AS c ON c.id = pg.course_id
        WHERE pg.course_id = ?
        ORDER BY a.weekday_index ASC, a.start_time ASC, a.position ASC
    """
    assessment_dates_sql = """
        SELECT
            id,
            date_value AS dateValue,
            kind,
            source,
            source_title AS sourceTitle,
            context,
            raw_text AS rawText
        FROM assessment_dates
        WHERE course_id = ?
        ORDER BY date_value ASC, kind ASC
    """
    content_sections_sql = """
        SELECT
            position,
            title,
            text,
            links_json AS linksJson
        FROM content_sections
        WHERE course_id = ?
        ORDER BY position ASC
    """
    course_fields_sql = """
        SELECT
            key,
            value,
            links_json AS linksJson
        FROM course_fields
        WHERE course_id = ?
        ORDER BY key ASC
    """

    lecturers = await fetch_all(env, lecturers_sql, [course_id])
    parallel_groups = await fetch_all(env, parallel_groups_sql, [course_id])
    appointments = await fetch_all(env, appointments_sql, [course_id])
    assessment_dates = await fetch_all(env, assessment_dates_sql, [course_id])
    content_sections = [
        _normalize_content_section(row)
        for row in await fetch_all(env, content_sections_sql, [course_id])
    ]
    course_fields = await fetch_all(env, course_fields_sql, [course_id])
    course_field_links: dict[str, list[dict[str, str]]] = {}
    for row in course_fields:
        if "key" not in row:
            continue
        links = _decode_text_links(row.get("linksJson"))
        if links:
            course_field_links[str(row["key"])] = links

    return {
        "course": course,
        "lecturers": lecturers,
        "parallelGroups": parallel_groups,
        "appointments": appointments,
        "assessmentDates": assessment_dates,
        "contentSections": content_sections,
        "courseFields": {
            row["key"]: row["value"]
            for row in course_fields
            if "key" in row and "value" in row
        },
        "courseFieldLinks": course_field_links,
    }
