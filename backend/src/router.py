from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse

from db.d1 import D1ExecutionError, fetch_all, fetch_one, has_database
from http_utils import empty_response, error_response, json_response
from services.course_catalog import (
    get_catalog_course_detail,
    get_course_detail,
    list_catalog_courses,
    list_courses,
)


async def _database_status(env: Any) -> dict[str, Any]:
    if not has_database(env):
        return {
            "configured": False,
            "reachable": False,
            "tableCount": 0,
        }

    try:
        row = await fetch_one(
            env,
            """
            SELECT COUNT(*) AS tableCount
            FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
            """,
        )
    except D1ExecutionError as exc:
        return {
            "configured": True,
            "reachable": False,
            "tableCount": 0,
            "error": str(exc),
        }

    return {
        "configured": True,
        "reachable": True,
        "tableCount": int(row["tableCount"]) if row and "tableCount" in row else 0,
    }


async def _list_study_programs(env: Any) -> list[dict[str, Any]]:
    sql = """
        SELECT
            id,
            code,
            name,
            degree,
            subject,
            po_version AS poVersion,
            total_ects AS totalEcts,
            language,
            source_status AS sourceStatus,
            notes
        FROM study_programs
        ORDER BY name ASC
    """
    return await fetch_all(env, sql)


async def route_request(request: Any, env: Any) -> Any:
    """Route incoming Cloudflare Worker requests."""
    method = str(getattr(request, "method", "GET")).upper()
    parsed_url = urlparse(str(getattr(request, "url", "/")))
    path = parsed_url.path.rstrip("/") or "/"

    if method == "OPTIONS":
        return empty_response(request, env)
    if method != "GET":
        return error_response(
            code="method_not_allowed",
            message="Only GET and OPTIONS are supported in the initial Cloudflare migration.",
            request=request,
            env=env,
            status=405,
        )

    try:
        if path == "/":
            return json_response(
                {
                    "service": "studyplaner-api",
                    "status": "ready",
                    "routes": {
                        "health": "/health",
                        "courses": "/api/courses?limit=50",
                        "courseDetail": "/api/courses/<id>",
                        "catalogCourses": "/api/catalog/courses?limit=100",
                        "catalogCourseDetail": "/api/catalog/courses/<id>",
                        "studyPrograms": "/api/study-programs",
                    },
                },
                request=request,
                env=env,
            )

        if path == "/health":
            return json_response(
                {
                    "ok": True,
                    "service": "studyplaner-api",
                    "database": await _database_status(env),
                },
                request=request,
                env=env,
            )

        if path == "/api/courses":
            query = parse_qs(parsed_url.query)
            limit_value = query.get("limit", ["50"])[0]
            try:
                limit = int(limit_value)
            except ValueError:
                limit = 50

            courses = await list_courses(env, limit)
            return json_response(
                {
                    "count": len(courses),
                    "courses": courses,
                },
                request=request,
                env=env,
            )

        if path == "/api/catalog/courses":
            query = parse_qs(parsed_url.query)
            limit_value = query.get("limit", ["100"])[0]
            search_value = query.get("q", [None])[0]
            try:
                limit = int(limit_value)
            except ValueError:
                limit = 100

            courses = await list_catalog_courses(env, limit=limit, search=search_value)
            return json_response(
                {
                    "count": len(courses),
                    "courses": courses,
                },
                request=request,
                env=env,
            )

        if path.startswith("/api/catalog/courses/"):
            course_id_text = path.removeprefix("/api/catalog/courses/")
            try:
                course_id = int(course_id_text)
            except ValueError:
                return error_response(
                    code="invalid_course_id",
                    message="Course ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )

            course_detail = await get_catalog_course_detail(env, course_id)
            if course_detail is None:
                return error_response(
                    code="course_not_found",
                    message="No course exists for the requested id.",
                    request=request,
                    env=env,
                    status=404,
                )

            return json_response(course_detail, request=request, env=env)

        if path.startswith("/api/courses/"):
            course_id_text = path.removeprefix("/api/courses/")
            try:
                course_id = int(course_id_text)
            except ValueError:
                return error_response(
                    code="invalid_course_id",
                    message="Course ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )

            course_detail = await get_course_detail(env, course_id)
            if course_detail is None:
                return error_response(
                    code="course_not_found",
                    message="No course exists for the requested id.",
                    request=request,
                    env=env,
                    status=404,
                )

            return json_response(course_detail, request=request, env=env)

        if path == "/api/study-programs":
            programs = await _list_study_programs(env)
            return json_response(
                {
                    "count": len(programs),
                    "studyPrograms": programs,
                },
                request=request,
                env=env,
            )
    except D1ExecutionError as exc:
        return error_response(
            code="database_error",
            message=str(exc),
            request=request,
            env=env,
            status=500,
        )

    return error_response(
        code="not_found",
        message="The requested route does not exist.",
        request=request,
        env=env,
        status=404,
    )
