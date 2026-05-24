from __future__ import annotations

import re
from typing import Any

from db.d1 import fetch_all, fetch_one

CATALOG_FILTER_SQL = """
    (
        c.organisation LIKE '%Fachbereich Informatik%'
        OR c.number LIKE 'INF%'
        OR c.number LIKE 'INFO%'
        OR c.number LIKE 'INFM%'
        OR c.number LIKE 'INFL%'
    )
"""

MASTER_CAT_ORDER = ["TECH", "THEO", "PRAK", "INFO", "FOKUS", "BASIS"]
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
ECTS_TEXT_PATTERN = re.compile(r'(?<!\d)(\d+(?:[.,]\d+)?)\s*(?:cp|ects)\b', re.IGNORECASE)


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
        return "FOKUS"
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


def _build_schedule(appointment_rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    schedule: list[dict[str, str]] = []
    seen_slots: set[tuple[str, str, str, str]] = set()

    for row in appointment_rows:
        day = _safe_text(row.get("weekday")) or _safe_text(row.get("dateText")) or "TBA"
        time_text = _safe_text(row.get("timeText")) or "TBA"
        room_text = _safe_text(row.get("roomText")) or "TBA"
        slot_type = _safe_text(row.get("groupType")) or _safe_text(row.get("courseType")) or "Course"

        slot_key = (day, time_text, room_text, slot_type)
        if slot_key in seen_slots:
            continue
        seen_slots.add(slot_key)
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


def _pick_description(short_comment: str | None, content_sections: list[dict[str, Any]]) -> str:
    if short_comment:
        return short_comment

    for section in content_sections:
        section_title = (_safe_text(section.get("title")) or "").lower()
        if not any(keyword in section_title for keyword in DESCRIPTION_SECTION_KEYWORDS):
            continue
        section_text = _safe_text(section.get("text"))
        if section_text:
            return section_text

    for section in content_sections:
        section_text = _safe_text(section.get("text"))
        if section_text:
            return section_text

    return ""


_D1_CHUNK_SIZE = 50


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

    lecturer_rows = await fetch_all(
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
    )

    parallel_group_rows = await fetch_all(
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
    )

    appointment_rows = await fetch_all(
        env,
        f"""
        SELECT
            pg.course_id AS courseId,
            pg.group_type AS groupType,
            c.course_type AS courseType,
            a.weekday,
            a.weekday_index AS weekdayIndex,
            a.time_text AS timeText,
            a.date_text AS dateText,
            a.start_time AS startTime,
            a.room_text AS roomText,
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
    )

    option_rows = await fetch_all(
        env,
        f"""
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
            opt.ects_counted AS ectsCounted
        FROM course_curriculum_matches AS m
        JOIN curriculum_modules AS cm ON cm.id = m.module_id
        LEFT JOIN module_study_area_options AS opt ON opt.module_id = cm.id
        LEFT JOIN study_areas AS sa ON sa.id = opt.study_area_id
        LEFT JOIN study_programs AS sp ON sp.id = sa.program_id
        WHERE m.course_id IN ({placeholders})
        ORDER BY m.course_id ASC, sp.code ASC, sa.sort_order ASC, sa.name ASC
        """,
        chunk,
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


async def list_catalog_courses(
    env: Any,
    limit: int = 100,
    search: str | None = None,
) -> list[dict[str, Any]]:
    safe_limit = max(1, min(limit, 200))
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
            c.detail_page_url AS detailPageUrl
        FROM courses AS c
        WHERE {CATALOG_FILTER_SQL}
    """

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


async def get_catalog_course_detail(env: Any, course_id: int) -> dict[str, Any] | None:
    raw_detail = await get_course_detail(env, course_id)
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

    summary.update(
        {
            "description": _pick_description(summary.get("shortComment"), content_sections),
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
    course_sql = """
        SELECT
            id,
            run_id AS runId,
            node_id AS nodeId,
            unit_id AS unitId,
            period_id AS periodId,
            title,
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
        FROM courses
        WHERE id = ?
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
            text
        FROM content_sections
        WHERE course_id = ?
        ORDER BY position ASC
    """
    course_fields_sql = """
        SELECT
            key,
            value
        FROM course_fields
        WHERE course_id = ?
        ORDER BY key ASC
    """

    lecturers = await fetch_all(env, lecturers_sql, [course_id])
    parallel_groups = await fetch_all(env, parallel_groups_sql, [course_id])
    appointments = await fetch_all(env, appointments_sql, [course_id])
    assessment_dates = await fetch_all(env, assessment_dates_sql, [course_id])
    content_sections = await fetch_all(env, content_sections_sql, [course_id])
    course_fields = await fetch_all(env, course_fields_sql, [course_id])

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
    }
