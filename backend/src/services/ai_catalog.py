"""AI facade over the public course catalog (plan: docs/ai-integrations-mcp-openapi-plan.md).

Phase 1 only exposes unauthenticated catalog reads with compact,
citation-friendly payloads for ChatGPT Actions and MCP adapters.
"""

from __future__ import annotations

import re
from typing import Any

from services.course_catalog import get_catalog_course_detail, list_catalog_courses

AI_API_VERSION = "1"
MAX_SEARCH_LIMIT = 25
# When structured filters are present we post-filter a wider candidate slice,
# because list_catalog_courses cannot apply these filters server-side yet.
FILTERED_CANDIDATE_LIMIT = 400

_WEEKDAY_ALIASES: dict[str, str] = {
    "mo": "monday", "mon": "monday", "montag": "monday", "monday": "monday",
    "di": "tuesday", "die": "tuesday", "tue": "tuesday", "dienstag": "tuesday", "tuesday": "tuesday",
    "mi": "wednesday", "mit": "wednesday", "wed": "wednesday", "mittwoch": "wednesday", "wednesday": "wednesday",
    "do": "thursday", "don": "thursday", "thu": "thursday", "donnerstag": "thursday", "thursday": "thursday",
    "fr": "friday", "fre": "friday", "fri": "friday", "freitag": "friday", "friday": "friday",
    "sa": "saturday", "sam": "saturday", "sat": "saturday", "samstag": "saturday", "saturday": "saturday",
    "so": "sunday", "son": "sunday", "sun": "sunday", "sonntag": "sunday", "sunday": "sunday",
}
_TIME_RANGE_PATTERN = re.compile(r"(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})")


def build_ai_meta(base_url: str) -> dict[str, Any]:
    return {
        "service": "studyplanner-ai",
        "apiVersion": AI_API_VERSION,
        "openapiUrl": f"{base_url}/api/ai/openapi.json",
        "capabilities": ["searchCourses", "getCourseDetail", "resolveCourse"],
        "auth": "none (public catalog only in this version)",
    }


def summarize_course_for_ai(course: dict[str, Any]) -> dict[str, Any]:
    """Compact projection: IDs plus human labels, no raw payload dumps."""
    return {
        "courseId": course.get("id"),
        "courseNumber": course.get("number") or None,
        "title": course.get("title"),
        "periodLabel": course.get("periodLabel"),
        "offeredPeriods": course.get("offeredPeriods", []),
        "termType": course.get("termType"),
        "ects": course.get("ects"),
        "lecturer": course.get("lecturer") or None,
        "types": course.get("types", []),
        "studyAreaCodes": sorted(
            {
                option.get("studyAreaCode")
                for option in course.get("studyAreaOptions", [])
                if option.get("studyAreaCode")
            }
        ),
        "schedule": course.get("schedule", []),
        "detailUrl": course.get("detailUrl") or None,
    }


def detail_course_for_ai(course: dict[str, Any]) -> dict[str, Any]:
    summary = summarize_course_for_ai(course)
    summary.update(
        {
            "description": course.get("description") or None,
            "prerequisites": course.get("prerequisites", []),
            "exams": course.get("exams", []),
            "language": course.get("language") or None,
            "sws": course.get("sws"),
            "externalLinks": course.get("externalLinks", []),
        }
    )
    return summary


def _string_list(value: Any, field_name: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise ValueError(f"'{field_name}' must be a list of strings.")
    return [item.strip() for item in value if item.strip()]


def _optional_number(value: Any, field_name: str) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"'{field_name}' must be a number.")
    return float(value)


def _parse_minutes(value: Any, field_name: str) -> int | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError(f"'{field_name}' must be a 'HH:MM' string.")
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match:
        raise ValueError(f"'{field_name}' must be a 'HH:MM' string.")
    return int(match.group(1)) * 60 + int(match.group(2))


def _parse_filters(payload: dict[str, Any]) -> dict[str, Any]:
    ects_raw = payload.get("ects")
    if ects_raw is not None and not isinstance(ects_raw, dict):
        raise ValueError("'ects' must be an object with optional min/max/exact.")
    ects_raw = ects_raw or {}

    time_window_raw = payload.get("timeWindow")
    if time_window_raw is not None and not isinstance(time_window_raw, dict):
        raise ValueError("'timeWindow' must be an object with start/end.")
    time_window_raw = time_window_raw or {}

    weekdays = []
    for raw_day in _string_list(payload.get("weekdays"), "weekdays"):
        normalized = _WEEKDAY_ALIASES.get(raw_day.lower())
        if normalized:
            weekdays.append(normalized)

    return {
        "ects_min": _optional_number(ects_raw.get("min"), "ects.min"),
        "ects_max": _optional_number(ects_raw.get("max"), "ects.max"),
        "ects_exact": _optional_number(ects_raw.get("exact"), "ects.exact"),
        "weekdays": weekdays,
        "time_start": _parse_minutes(time_window_raw.get("start"), "timeWindow.start"),
        "time_end": _parse_minutes(time_window_raw.get("end"), "timeWindow.end"),
        "course_types": [item.lower() for item in _string_list(payload.get("courseTypes"), "courseTypes")],
        "study_area_codes": [item.upper() for item in _string_list(payload.get("studyAreaCodes"), "studyAreaCodes")],
        "term_types": [item.lower() for item in _string_list(payload.get("termTypes"), "termTypes")],
    }


def _has_active_filters(filters: dict[str, Any]) -> bool:
    return any(
        filters[key] not in (None, [])
        for key in (
            "ects_min", "ects_max", "ects_exact", "weekdays",
            "time_start", "time_end", "course_types", "study_area_codes", "term_types",
        )
    )


def parse_search_payload(payload: dict[str, Any]) -> dict[str, Any]:
    query = payload.get("query")
    if query is not None and not isinstance(query, str):
        raise ValueError("'query' must be a string.")

    raw_limit = payload.get("limit", 10)
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError) as exc:
        raise ValueError("'limit' must be an integer.") from exc
    limit = max(1, min(limit, MAX_SEARCH_LIMIT))

    period_id = payload.get("periodId") or "all"
    if not isinstance(period_id, str):
        raise ValueError("'periodId' must be a string.")

    return {
        "query": query,
        "limit": limit,
        "period_id": period_id,
        "filters": _parse_filters(payload),
    }


def _slot_minutes(time_text: str) -> tuple[int, int] | None:
    match = _TIME_RANGE_PATTERN.search(time_text or "")
    if not match:
        return None
    start = int(match.group(1)) * 60 + int(match.group(2))
    end = int(match.group(3)) * 60 + int(match.group(4))
    return (start, end) if end > start else None


def course_matches_ai_filters(summary: dict[str, Any], filters: dict[str, Any]) -> bool:
    """Apply the structured AI search filters to a compact course summary."""
    ects = summary.get("ects")
    if filters["ects_exact"] is not None or filters["ects_min"] is not None or filters["ects_max"] is not None:
        if ects is None:
            return False
        if filters["ects_exact"] is not None and float(ects) != filters["ects_exact"]:
            return False
        if filters["ects_min"] is not None and float(ects) < filters["ects_min"]:
            return False
        if filters["ects_max"] is not None and float(ects) > filters["ects_max"]:
            return False

    if filters["term_types"]:
        term_type = (summary.get("termType") or "").lower()
        # A course offered in both terms satisfies any single-term request.
        if term_type != "both" and term_type not in filters["term_types"]:
            return False

    if filters["course_types"]:
        type_texts = " ".join(summary.get("types", [])).lower()
        if not any(keyword in type_texts for keyword in filters["course_types"]):
            return False

    if filters["study_area_codes"]:
        course_codes = {code.upper() for code in summary.get("studyAreaCodes", [])}
        if course_codes.isdisjoint(filters["study_area_codes"]):
            return False

    schedule = summary.get("schedule", [])
    if filters["weekdays"]:
        slot_days = {
            _WEEKDAY_ALIASES.get(str(slot.get("day", "")).strip().lower()[:3])
            or _WEEKDAY_ALIASES.get(str(slot.get("day", "")).strip().lower())
            for slot in schedule
        }
        if slot_days.isdisjoint(filters["weekdays"]):
            return False

    if filters["time_start"] is not None or filters["time_end"] is not None:
        window_start = filters["time_start"] if filters["time_start"] is not None else 0
        window_end = filters["time_end"] if filters["time_end"] is not None else 24 * 60
        fits = False
        for slot in schedule:
            slot_range = _slot_minutes(str(slot.get("time", "")))
            if slot_range and slot_range[0] >= window_start and slot_range[1] <= window_end:
                fits = True
                break
        if not fits:
            return False

    return True


async def search_courses_for_ai(env: Any, payload: dict[str, Any]) -> dict[str, Any]:
    options = parse_search_payload(payload)
    filters = options["filters"]
    limit = options["limit"]

    if _has_active_filters(filters):
        # Post-filter a wide candidate slice, since these filters are not yet
        # pushed into the SQL query.
        candidates = await list_catalog_courses(
            env,
            limit=FILTERED_CANDIDATE_LIMIT,
            search=options["query"],
            period_id=options["period_id"],
        )
        matched = [
            summary
            for summary in (summarize_course_for_ai(course) for course in candidates)
            if course_matches_ai_filters(summary, filters)
        ]
        truncated = len(matched) > limit
        return {"courses": matched[:limit], "count": min(len(matched), limit), "truncated": truncated}

    # Fetch a wider slice so the post-limit truncation flag is meaningful.
    courses = await list_catalog_courses(
        env,
        limit=limit + 1,
        search=options["query"],
        period_id=options["period_id"],
    )
    truncated = len(courses) > limit
    return {
        "courses": [summarize_course_for_ai(course) for course in courses[:limit]],
        "count": min(len(courses), limit),
        "truncated": truncated,
    }


def parse_resolve_payload(payload: dict[str, Any]) -> dict[str, Any]:
    course_number = payload.get("courseNumber")
    if not isinstance(course_number, str) or not course_number.strip():
        raise ValueError("'courseNumber' is required and must be a non-empty string.")

    period_id = payload.get("periodId") or "all"
    if not isinstance(period_id, str):
        raise ValueError("'periodId' must be a string.")

    title_hint = payload.get("titleHint")
    if title_hint is not None and not isinstance(title_hint, str):
        raise ValueError("'titleHint' must be a string.")

    return {
        "course_number": course_number.strip(),
        "period_id": period_id,
        "title_hint": (title_hint or "").strip().lower() or None,
    }


def pick_resolved_course(
    summaries: list[dict[str, Any]],
    course_number: str,
    title_hint: str | None,
) -> dict[str, Any] | None:
    """Best stable-reference match: exact number wins, title hint breaks ties."""
    normalized_number = course_number.strip().lower()
    exact_matches = [
        summary
        for summary in summaries
        if (summary.get("courseNumber") or "").strip().lower() == normalized_number
    ]
    pool = exact_matches or summaries
    if not pool:
        return None
    if title_hint:
        for summary in pool:
            if title_hint in (summary.get("title") or "").lower():
                return summary
    return pool[0]


async def resolve_course_reference(env: Any, payload: dict[str, Any]) -> dict[str, Any]:
    options = parse_resolve_payload(payload)
    candidates = await list_catalog_courses(
        env,
        limit=MAX_SEARCH_LIMIT,
        search=options["course_number"],
        period_id=options["period_id"],
    )
    summaries = [summarize_course_for_ai(course) for course in candidates]
    match = pick_resolved_course(summaries, options["course_number"], options["title_hint"])
    return {
        "match": match,
        "candidates": summaries[:MAX_SEARCH_LIMIT],
        "count": len(summaries),
    }


async def get_course_detail_for_ai(env: Any, course_id: int) -> dict[str, Any] | None:
    detail = await get_catalog_course_detail(env, course_id)
    if detail is None:
        return None
    return detail_course_for_ai(detail)


def build_openapi_schema(base_url: str) -> dict[str, Any]:
    """OpenAPI 3.1 document for ChatGPT Actions (public endpoints only)."""
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "StudyPlanner AI API",
            "version": AI_API_VERSION,
            "description": (
                "Public course catalog of the StudyPlanner for Informatik at the "
                "University of Tübingen. Read-only; no personal data."
            ),
        },
        "servers": [{"url": base_url}],
        "paths": {
            "/api/ai/catalog/search": {
                "post": {
                    "operationId": "searchCourses",
                    "summary": "Search Informatics courses across semesters",
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "properties": {
                                        "query": {
                                            "type": "string",
                                            "description": "Free-text search over title, number, organisation.",
                                        },
                                        "limit": {
                                            "type": "integer",
                                            "minimum": 1,
                                            "maximum": MAX_SEARCH_LIMIT,
                                            "default": 10,
                                        },
                                        "periodId": {
                                            "type": "string",
                                            "description": "Catalog period id, or 'all' for the deduplicated multi-semester catalog (default).",
                                        },
                                        "ects": {
                                            "type": "object",
                                            "description": "ECTS filter; use exact, or min/max for a range.",
                                            "properties": {
                                                "min": {"type": "number"},
                                                "max": {"type": "number"},
                                                "exact": {"type": "number"},
                                            },
                                        },
                                        "weekdays": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "Weekdays a course must meet on, e.g. ['Monday','Mi'] (German or English).",
                                        },
                                        "timeWindow": {
                                            "type": "object",
                                            "description": "Only courses whose slots fall fully inside this window.",
                                            "properties": {
                                                "start": {"type": "string", "description": "'HH:MM'"},
                                                "end": {"type": "string", "description": "'HH:MM'"},
                                            },
                                        },
                                        "courseTypes": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "Course-type keywords, e.g. ['lecture','seminar','Vorlesung'].",
                                        },
                                        "studyAreaCodes": {
                                            "type": "array",
                                            "items": {"type": "string"},
                                            "description": "Regulation study-area codes, e.g. ['INFO-THEO','ML-FOUND'].",
                                        },
                                        "termTypes": {
                                            "type": "array",
                                            "items": {"type": "string", "enum": ["summer", "winter"]},
                                            "description": "Restrict to summer and/or winter courses.",
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Matching courses with compact metadata.",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        }
                    },
                }
            },
            "/api/ai/catalog/resolve-course": {
                "post": {
                    "operationId": "resolveCourse",
                    "summary": "Resolve a course number (and optional title hint) to a current course id",
                    "description": (
                        "Numeric course ids are period/import specific. Resolve a stable "
                        "course number into the current id before quoting or linking a course."
                    ),
                    "requestBody": {
                        "required": True,
                        "content": {
                            "application/json": {
                                "schema": {
                                    "type": "object",
                                    "required": ["courseNumber"],
                                    "properties": {
                                        "courseNumber": {"type": "string"},
                                        "periodId": {
                                            "type": "string",
                                            "description": "Catalog period id, or 'all' (default).",
                                        },
                                        "titleHint": {
                                            "type": "string",
                                            "description": "Optional title fragment to disambiguate.",
                                        },
                                    },
                                }
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Best-match course plus candidate list.",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        }
                    },
                }
            },
            "/api/ai/catalog/courses/{courseId}": {
                "get": {
                    "operationId": "getCourseDetail",
                    "summary": "Get the full public detail of one course",
                    "parameters": [
                        {
                            "name": "courseId",
                            "in": "path",
                            "required": True,
                            "schema": {"type": "integer"},
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Course detail including description, schedule, and exams.",
                            "content": {"application/json": {"schema": {"type": "object"}}},
                        },
                        "404": {"description": "Unknown course id."},
                    },
                }
            },
        },
    }
