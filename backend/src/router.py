from __future__ import annotations

import traceback
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from db.d1 import D1ExecutionError, fetch_all, fetch_one, has_database
from http_utils import empty_response, error_response, json_response
from request_utils import RequestBodyError, read_json_object
from services.authentication import (
    AuthConfigurationError,
    AuthenticationError,
    AuthorizationError,
    CredentialUpdateError,
    ProfileUpdateError,
    RegistrationError,
    get_authenticated_user,
    get_current_user_profile,
    login_user,
    logout_user,
    register_user,
    update_current_user_profile,
    update_user_credentials,
)
from services.ai_catalog import (
    build_ai_meta,
    build_openapi_schema,
    get_course_detail_for_ai,
    resolve_course_reference,
    search_courses_for_ai,
)
from services.course_catalog import (
    get_catalog_course_detail,
    get_course_detail,
    list_catalog_courses,
    list_catalog_periods,
    list_courses,
)
from services.progress import get_current_user_progress
from services.planner_assignments import (
    PlannerAssignmentError,
    balance_current_user_semester_plan,
)
from services.regulations import (
    get_regulation_version,
    list_regulation_course_categories,
    list_regulation_versions,
)
from services.user_completed_courses import (
    CompletedCourseUpdateError,
    get_current_user_completed_courses,
    import_current_user_completed_courses,
    replace_current_user_completed_courses,
)
from services.user_favorites import (
    FavoriteUpdateError,
    get_current_user_favorites,
    replace_current_user_favorites,
)
from services.user_transcript_issues import (
    TranscriptIssueUpdateError,
    get_current_user_transcript_issues,
    replace_current_user_transcript_issues,
)
from services.user_semester_plans import (
    SemesterPlanUpdateError,
    delete_current_user_semester_plan,
    get_current_user_semester_plan,
    list_current_user_semester_plans,
    replace_current_user_semester_plan,
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
                JOIN regulation_versions AS all_versions
                    ON all_versions.id = all_mappings.regulation_version_id
                WHERE all_mappings.study_program_id = sp.id
                  AND all_versions.source_status = 'official'
                  AND all_versions.version_label = '2021'
            ) AS regulationVersionCount
        FROM study_programs AS sp
        JOIN study_program_regulation_versions AS sprv
            ON sprv.study_program_id = sp.id
           AND sprv.is_default = 1
        JOIN regulation_versions AS rv
            ON rv.id = sprv.regulation_version_id
           AND rv.source_status = 'official'
           AND rv.version_label = '2021'
        JOIN examination_regulations AS er ON er.id = rv.regulation_id
        WHERE sp.source_status = 'official'
          AND sp.po_version = '2021'
        ORDER BY sp.degree ASC, sp.name ASC
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

    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}" if parsed_url.netloc else ""

    try:
        if path == "/api/ai/meta":
            if method != "GET":
                return _method_not_allowed_response(request, env)
            return json_response(build_ai_meta(base_url), request=request, env=env)

        if path == "/api/ai/openapi.json":
            if method != "GET":
                return _method_not_allowed_response(request, env)
            return json_response(build_openapi_schema(base_url), request=request, env=env)

        if path == "/api/ai/catalog/search":
            if method != "POST":
                return _method_not_allowed_response(request, env)
            try:
                search_result = await search_courses_for_ai(env, await read_json_object(request))
            except ValueError as exc:
                return error_response(
                    code="invalid_search_payload",
                    message=str(exc),
                    request=request,
                    env=env,
                    status=400,
                )
            return json_response(search_result, request=request, env=env)

        if path == "/api/ai/catalog/resolve-course":
            if method != "POST":
                return _method_not_allowed_response(request, env)
            try:
                resolve_result = await resolve_course_reference(env, await read_json_object(request))
            except ValueError as exc:
                return error_response(
                    code="invalid_resolve_payload",
                    message=str(exc),
                    request=request,
                    env=env,
                    status=400,
                )
            return json_response(resolve_result, request=request, env=env)

        if path.startswith("/api/ai/catalog/courses/"):
            if method != "GET":
                return _method_not_allowed_response(request, env)
            course_id_text = path.removeprefix("/api/ai/catalog/courses/")
            try:
                ai_course_id = int(course_id_text)
            except ValueError:
                return error_response(
                    code="invalid_course_id",
                    message="Course ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )
            ai_course_detail = await get_course_detail_for_ai(env, ai_course_id)
            if ai_course_detail is None:
                return error_response(
                    code="course_not_found",
                    message="No course exists for the requested id.",
                    request=request,
                    env=env,
                    status=404,
                )
            return json_response(ai_course_detail, request=request, env=env)

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

        if path == "/api/me/credentials":
            if method == "PATCH":
                updated = await update_user_credentials(env, request, await read_json_object(request))
                return json_response({"user": updated}, request=request, env=env)
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

        if path == "/api/me/completed-courses":
            if method == "GET":
                completed_courses = await get_current_user_completed_courses(env, request)
                return json_response(completed_courses, request=request, env=env)
            if method == "PUT":
                completed_courses = await replace_current_user_completed_courses(
                    env,
                    request,
                    await read_json_object(request),
                )
                return json_response(completed_courses, request=request, env=env)
            return _method_not_allowed_response(request, env)

        if path == "/api/me/completed-courses/import":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            completed_courses = await import_current_user_completed_courses(
                env,
                request,
                await read_json_object(request),
            )
            return json_response(completed_courses, request=request, env=env)

        if path == "/api/me/transcript-issues":
            if method == "GET":
                transcript_issues = await get_current_user_transcript_issues(env, request)
                return json_response(transcript_issues, request=request, env=env)
            if method == "PUT":
                transcript_issues = await replace_current_user_transcript_issues(
                    env,
                    request,
                    await read_json_object(request),
                )
                return json_response(transcript_issues, request=request, env=env)
            return _method_not_allowed_response(request, env)

        if path == "/api/me/semester-plans":
            if method != "GET":
                return _method_not_allowed_response(request, env)

            semester_plans = await list_current_user_semester_plans(env, request)
            return json_response(semester_plans, request=request, env=env)

        if path.startswith("/api/me/semester-plans/") and path.endswith("/balance"):
            if method != "POST":
                return _method_not_allowed_response(request, env)

            semester_label = unquote(
                path.removeprefix("/api/me/semester-plans/").removesuffix("/balance")
            )
            balance_result = await balance_current_user_semester_plan(
                env,
                request,
                await read_json_object(request),
            )
            return json_response(balance_result, request=request, env=env)

        if path.startswith("/api/me/semester-plans/"):
            semester_label = unquote(path.removeprefix("/api/me/semester-plans/"))
            if method == "GET":
                semester_plan = await get_current_user_semester_plan(env, request, semester_label)
                if semester_plan is None:
                    return error_response(
                        code="semester_plan_not_found",
                        message="No saved semester plan exists for the requested semester.",
                        request=request,
                        env=env,
                        status=404,
                    )
                return json_response({"semesterPlan": semester_plan}, request=request, env=env)
            if method == "PUT":
                semester_plan = await replace_current_user_semester_plan(
                    env,
                    request,
                    semester_label,
                    await read_json_object(request),
                )
                return json_response(semester_plan, request=request, env=env)
            if method == "DELETE":
                await delete_current_user_semester_plan(env, request, semester_label)
                return empty_response(request=request, env=env)
            return _method_not_allowed_response(request, env)

        if path == "/api/me/progress":
            if method != "GET":
                return _method_not_allowed_response(request, env)

            progress = await get_current_user_progress(env, request)
            return json_response(progress, request=request, env=env)

        if method != "GET":
            return _method_not_allowed_response(request, env)

        if path == "/":
            return json_response(
                {
                    "service": "studyplanner-api",
                    "status": "ready",
                    "routes": {
                        "health": "/health",
                        "register": "/api/auth/register",
                        "login": "/api/auth/login",
                        "session": "/api/auth/session",
                        "profile": "/api/me/profile",
                        "favorites": "/api/me/favorites",
                        "completedCourses": "/api/me/completed-courses",
                        "completedCoursesImport": "/api/me/completed-courses/import",
                        "transcriptIssues": "/api/me/transcript-issues",
                        "semesterPlans": "/api/me/semester-plans",
                        "semesterPlanBalance": "/api/me/semester-plans/<semester_label>/balance",
                        "progress": "/api/me/progress",
                        "courses": "/api/courses?limit=50",
                        "courseDetail": "/api/courses/<id>",
                        "catalogPeriods": "/api/catalog/periods",
                        "catalogCourses": "/api/catalog/courses?limit=100&period=<periodId|all>",
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
                    "service": "studyplanner-api",
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

        if path == "/api/catalog/periods":
            periods = await list_catalog_periods(env)
            return json_response(
                {
                    "count": len(periods),
                    "periods": periods,
                },
                request=request,
                env=env,
            )

        if path == "/api/catalog/courses":
            query = parse_qs(parsed_url.query)
            limit_value = query.get("limit", ["100"])[0]
            search_value = query.get("q", [None])[0]
            period_value = query.get("period", [None])[0]
            try:
                limit = int(limit_value)
            except ValueError:
                limit = 100

            courses = await list_catalog_courses(
                env,
                limit=limit,
                search=search_value,
                period_id=period_value,
            )
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
    except CredentialUpdateError as exc:
        return error_response(
            code="credential_update_error",
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
    except CompletedCourseUpdateError as exc:
        return error_response(
            code="completed_course_update_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except TranscriptIssueUpdateError as exc:
        return error_response(
            code="transcript_issue_update_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except SemesterPlanUpdateError as exc:
        return error_response(
            code="semester_plan_update_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except PlannerAssignmentError as exc:
        return error_response(
            code="planner_assignment_error",
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
    except AuthConfigurationError as exc:
        return error_response(
            code="authentication_not_configured",
            message=str(exc),
            request=request,
            env=env,
            status=500,
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
    except Exception:
        traceback.print_exc()
        return error_response(
            code="internal_server_error",
            message="The server hit an unexpected error while processing this request.",
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
