"""AI facade over the public course catalog (plan: docs/ai-integrations-mcp-openapi-plan.md).

Phase 1 only exposes unauthenticated catalog reads with compact,
citation-friendly payloads for ChatGPT Actions and MCP adapters.
"""

from __future__ import annotations

from typing import Any

from services.course_catalog import get_catalog_course_detail, list_catalog_courses

AI_API_VERSION = "1"
MAX_SEARCH_LIMIT = 25


def build_ai_meta(base_url: str) -> dict[str, Any]:
    return {
        "service": "studyplanner-ai",
        "apiVersion": AI_API_VERSION,
        "openapiUrl": f"{base_url}/api/ai/openapi.json",
        "capabilities": ["searchCourses", "getCourseDetail"],
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

    return {"query": query, "limit": limit, "period_id": period_id}


async def search_courses_for_ai(env: Any, payload: dict[str, Any]) -> dict[str, Any]:
    options = parse_search_payload(payload)
    # Fetch a wider slice so the post-limit truncation flag is meaningful.
    courses = await list_catalog_courses(
        env,
        limit=options["limit"] + 1,
        search=options["query"],
        period_id=options["period_id"],
    )
    truncated = len(courses) > options["limit"]
    return {
        "courses": [summarize_course_for_ai(course) for course in courses[: options["limit"]]],
        "count": min(len(courses), options["limit"]),
        "truncated": truncated,
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
