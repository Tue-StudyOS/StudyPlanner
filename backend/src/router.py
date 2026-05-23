from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse

from db.d1 import D1ExecutionError, fetch_all, fetch_one, has_database
from http_utils import empty_response, error_response, json_response
from request_utils import RequestBodyError, read_json_object
from services.authentication import (
    AuthenticationError,
    AuthorizationError,
    ProfileUpdateError,
    RegistrationError,
    get_authenticated_user,
    get_current_user_profile,
    login_user,
    logout_user,
    register_user,
    update_current_user_profile,
)
from services.course_catalog import (
    get_catalog_course_detail,
    get_course_detail,
    list_catalog_courses,
    list_courses,
)
from services.regulations import (
    get_regulation_version,
    list_regulation_course_categories,
    list_regulation_versions,
)
from services.user_favorites import (
    FavoriteUpdateError,
    get_current_user_favorites,
    replace_current_user_favorites,
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
            sp.id,
            sp.code,
            sp.name,
            sp.degree,
            sp.subject,
            sp.po_version AS poVersion,
            sp.total_ects AS totalEcts,
            sp.language,
            sp.source_status AS sourceStatus,
            sp.notes,
            rv.code AS defaultRegulationVersionCode,
            rv.version_label AS defaultRegulationVersionLabel,
            er.code AS defaultRegulationCode,
            er.name AS defaultRegulationName,
            sprv.enrollment_match AS enrollmentMatch,
            (
                SELECT COUNT(*)
                FROM study_program_regulation_versions AS all_mappings
                WHERE all_mappings.study_program_id = sp.id
            ) AS regulationVersionCount
        FROM study_programs AS sp
        LEFT JOIN study_program_regulation_versions AS sprv
            ON sprv.study_program_id = sp.id
           AND sprv.is_default = 1
        LEFT JOIN regulation_versions AS rv ON rv.id = sprv.regulation_version_id
        LEFT JOIN examination_regulations AS er ON er.id = rv.regulation_id
        ORDER BY sp.name ASC
    """
    return await fetch_all(env, sql)


def _method_not_allowed_response(request: Any, env: Any) -> Any:
    return error_response(
        code="method_not_allowed",
        message="The requested route does not support this HTTP method.",
        request=request,
        env=env,
        status=405,
    )


async def route_request(request: Any, env: Any) -> Any:
    """Route incoming Cloudflare Worker requests."""
    method = str(getattr(request, "method", "GET")).upper()
    parsed_url = urlparse(str(getattr(request, "url", "/")))
    path = parsed_url.path.rstrip("/") or "/"

    if method == "OPTIONS":
        return empty_response(request, env)

    try:
        if path == "/api/auth/register":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            auth_payload = await register_user(env, await read_json_object(request), request)
            return json_response(auth_payload, request=request, env=env, status=201)

        if path == "/api/auth/login":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            auth_payload = await login_user(env, await read_json_object(request), request)
            return json_response(auth_payload, request=request, env=env)

        if path == "/api/auth/logout":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            await logout_user(env, request)
            return empty_response(request=request, env=env)

        if path == "/api/auth/session":
            if method != "GET":
                return _method_not_allowed_response(request, env)

            user = await get_authenticated_user(env, request)
            return json_response(
                {
                    "authenticated": user is not None,
                    "user": user,
                },
                request=request,
                env=env,
            )

        if path == "/api/me/profile":
            if method == "GET":
                profile = await get_current_user_profile(env, request)
                return json_response({"user": profile}, request=request, env=env)
            if method == "PATCH":
                profile = await update_current_user_profile(
                    env,
                    request,
                    await read_json_object(request),
                )
                return json_response({"user": profile}, request=request, env=env)
            return _method_not_allowed_response(request, env)

        if path == "/api/me/favorites":
            if method == "GET":
                favorites = await get_current_user_favorites(env, request)
                return json_response(favorites, request=request, env=env)
            if method == "PUT":
                favorites = await replace_current_user_favorites(
                    env,
                    request,
                    await read_json_object(request),
                )
                return json_response(favorites, request=request, env=env)
            return _method_not_allowed_response(request, env)

        if method != "GET":
            return _method_not_allowed_response(request, env)

        if path == "/":
            return json_response(
                {
                    "service": "studyplaner-api",
                    "status": "ready",
                    "routes": {
                        "health": "/health",
                        "register": "/api/auth/register",
                        "login": "/api/auth/login",
                        "session": "/api/auth/session",
                        "profile": "/api/me/profile",
                        "favorites": "/api/me/favorites",
                        "courses": "/api/courses?limit=50",
                        "courseDetail": "/api/courses/<id>",
                        "catalogCourses": "/api/catalog/courses?limit=100",
                        "catalogCourseDetail": "/api/catalog/courses/<id>",
                        "regulationVersions": "/api/regulation-versions",
                        "regulationCatalog": "/api/regulation-versions/<code>/courses?limit=100",
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

        if path == "/api/regulation-versions":
            versions = await list_regulation_versions(env)
            return json_response(
                {
                    "count": len(versions),
                    "regulationVersions": versions,
                },
                request=request,
                env=env,
            )

        if path.startswith("/api/regulation-versions/") and path.endswith("/courses"):
            regulation_version_code = path.removeprefix("/api/regulation-versions/").removesuffix(
                "/courses"
            )
            query = parse_qs(parsed_url.query)
            limit_value = query.get("limit", ["100"])[0]
            search_value = query.get("q", [None])[0]
            try:
                limit = int(limit_value)
            except ValueError:
                limit = 100

            version = await get_regulation_version(env, regulation_version_code)
            if version is None:
                return error_response(
                    code="regulation_version_not_found",
                    message="No regulation version exists for the requested code.",
                    request=request,
                    env=env,
                    status=404,
                )

            courses = await list_regulation_course_categories(
                env,
                regulation_version_code=regulation_version_code,
                limit=limit,
                search=search_value,
            )
            return json_response(
                {
                    "regulationVersion": {
                        key: value for key, value in version.items() if key != "ruleGroups"
                    },
                    "count": len(courses),
                    "courses": courses,
                },
                request=request,
                env=env,
            )

        if path.startswith("/api/regulation-versions/"):
            regulation_version_code = path.removeprefix("/api/regulation-versions/")
            version = await get_regulation_version(env, regulation_version_code)
            if version is None:
                return error_response(
                    code="regulation_version_not_found",
                    message="No regulation version exists for the requested code.",
                    request=request,
                    env=env,
                    status=404,
                )

            return json_response(version, request=request, env=env)

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
    except RequestBodyError as exc:
        return error_response(
            code="invalid_request_body",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except RegistrationError as exc:
        return error_response(
            code="registration_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except ProfileUpdateError as exc:
        return error_response(
            code="profile_update_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except FavoriteUpdateError as exc:
        return error_response(
            code="favorite_update_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except AuthenticationError as exc:
        return error_response(
            code="authentication_failed",
            message=str(exc),
            request=request,
            env=env,
            status=401,
        )
    except AuthorizationError as exc:
        return error_response(
            code="authorization_failed",
            message=str(exc),
            request=request,
            env=env,
            status=401,
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
