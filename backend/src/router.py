from __future__ import annotations

import traceback
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from db.d1 import D1ExecutionError, fetch_all, fetch_one, has_database
from http_utils import empty_response, error_response, html_response, json_response
from request_utils import RequestBodyError, read_json_object
from services.authentication import (
    AuthConfigurationError,
    AuthenticationError,
    AuthorizationError,
    CredentialUpdateError,
    CsrfProtectionError,
    ProfileUpdateError,
    RegistrationError,
    clear_auth_cookie,
    create_auth_cookie,
    create_csrf_token,
    get_authenticated_session,
    get_authenticated_user,
    get_current_user_profile,
    login_user,
    logout_user,
    read_login_identifier,
    register_user,
    require_csrf_protection,
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
from services.course_reviews import (
    CourseReviewAccessError,
    CourseReviewError,
    CourseReviewNotFoundError,
    delete_course_review,
    get_course_reviews,
    list_reviews_for_moderation,
    save_course_review,
    set_review_visibility,
)
from services.course_review_notices import (
    decide_review_notice,
    list_review_notices,
    submit_review_notice,
)
from services.app_settings import get_simulated_semester_label
from services.progress import get_current_user_progress
from services.client_error_log import ClientErrorLogError, list_client_errors, report_client_error
from services.request_rate_limit import (
    AI_CATALOG_POLICY,
    AUTH_LOGIN_POLICY,
    AUTH_REGISTRATION_POLICY,
    CLIENT_ERROR_POLICY,
    COURSE_REVIEW_POLICY,
    FEEDBACK_POLICY,
    REVIEW_NOTICE_POLICY,
    RateLimitError,
    enforce_failed_attempt_limit,
    enforce_rate_limit,
    record_failed_attempt,
)
from services.user_feedback import FeedbackSubmissionError, submit_feedback
from services.user_privacy import (
    AccountDeletionError,
    DataExportError,
    delete_current_user_account,
    export_current_user_data,
)
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
    get_current_user_anrechnung_optimization,
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
from services.user_transcript_data import clear_current_user_transcript_data
from services.user_semester_plans import (
    SemesterPlanUpdateError,
    delete_current_user_semester_plan,
    get_current_user_semester_plan,
    list_current_user_semester_plans,
    replace_current_user_semester_plan,
)


_PUBLIC_CATALOG_CACHE_HEADERS = {
    "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
}


_PRIVACY_HTML = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Privacy Policy – StudyPlanner AI Integration</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:680px;margin:48px auto;padding:0 20px;line-height:1.6;color:#111}
    h1{font-size:1.4rem;margin-bottom:.25rem}
    h2{font-size:1rem;margin-top:2rem}
    .muted{color:#6b7280;font-size:.875rem}
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p class="muted">StudyPlanner AI Integration &mdash; last updated 2026-06-18</p>
  <h2>What this integration does</h2>
  <p>The StudyPlanner GPT Action and MCP server provide read-only access to a public university course catalog. You can search courses, look up details, and resolve course numbers. No account, login, or personal information is required.</p>
  <h2>Data collected</h2>
  <p>This integration collects <strong>no personal data</strong>. Requests contain only the search terms or course identifiers you type. No names, email addresses, IP addresses, cookies, or session tokens are stored or logged by this service.</p>
  <h2>Data sharing</h2>
  <p>Search queries are forwarded to the StudyPlanner backend API to retrieve public catalog data. No data is sold, shared with third parties, or used for advertising.</p>
  <h2>Third-party services</h2>
  <p>The integration is hosted on Cloudflare Workers. Cloudflare may process request metadata (IP, timestamp) in accordance with <a href="https://www.cloudflare.com/privacypolicy/" rel="noreferrer noopener">Cloudflare&#39;s privacy policy</a>. ChatGPT or Claude interactions are governed by OpenAI&#39;s and Anthropic&#39;s respective privacy policies.</p>
  <h2>Contact</h2>
  <p>For questions, use the support contact provided in the integration listing.</p>
</body>
</html>"""


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


def _parse_numeric_path_id(value: str) -> int | None:
    try:
        return int(value)
    except ValueError:
        return None


def _new_session_response(auth_payload: dict[str, Any], request: Any, env: Any, status: int = 200) -> Any:
    token = str(auth_payload['token'])
    return json_response(
        {
            'user': auth_payload['user'],
            'csrfToken': create_csrf_token(env, token),
        },
        request=request,
        env=env,
        status=status,
        extra_headers={'set-cookie': create_auth_cookie(env, request, token)},
    )


async def route_request(request: Any, env: Any) -> Any:
    """Route incoming Cloudflare Worker requests."""
    method = str(getattr(request, "method", "GET")).upper()
    parsed_url = urlparse(str(getattr(request, "url", "/")))
    path = parsed_url.path.rstrip("/") or "/"

    if method == "OPTIONS":
        return empty_response(request, env)

    if path == "/privacy":
        return html_response(_PRIVACY_HTML, max_age=86400)

    base_url = f"{parsed_url.scheme}://{parsed_url.netloc}" if parsed_url.netloc else ""

    try:
        if method in {'POST', 'PUT', 'PATCH', 'DELETE'} and (
            path == '/api/auth/logout'
            or path.startswith('/api/me/')
            or path.startswith('/api/admin/')
        ):
            await require_csrf_protection(env, request)

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
            await enforce_rate_limit(env, request, AI_CATALOG_POLICY)
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
            await enforce_rate_limit(env, request, AI_CATALOG_POLICY)
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

            await enforce_rate_limit(env, request, AUTH_REGISTRATION_POLICY)
            auth_payload = await register_user(env, await read_json_object(request), request)
            return _new_session_response(auth_payload, request, env, status=201)

        if path == "/api/auth/login":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            login_payload = await read_json_object(request)
            login_identifier = read_login_identifier(login_payload)
            await enforce_failed_attempt_limit(
                env, request, AUTH_LOGIN_POLICY, identifier=login_identifier
            )
            try:
                auth_payload = await login_user(env, login_payload, request)
            except AuthenticationError:
                # Only a genuinely wrong credential costs budget. A 5xx from a
                # wedged isolate, and the retries it provokes, must not lock the
                # account out of an outage it did not cause.
                await record_failed_attempt(
                    env, request, AUTH_LOGIN_POLICY, identifier=login_identifier
                )
                raise
            return _new_session_response(auth_payload, request, env)

        if path == "/api/auth/logout":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            await logout_user(env, request)
            return empty_response(
                request=request,
                env=env,
                extra_headers={'set-cookie': clear_auth_cookie(request)},
            )

        if path == "/api/auth/session":
            if method != "GET":
                return _method_not_allowed_response(request, env)

            session = await get_authenticated_session(env, request)
            extra_headers = (
                {'set-cookie': create_auth_cookie(env, request, str(session['token']))}
                if session is not None
                else None
            )
            return json_response(
                {
                    "authenticated": session is not None,
                    "user": session['user'] if session is not None else None,
                    "csrfToken": session['csrfToken'] if session is not None else None,
                },
                request=request,
                env=env,
                extra_headers=extra_headers,
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

        if path == "/api/me/data-export":
            if method != "GET":
                return _method_not_allowed_response(request, env)
            export_payload = await export_current_user_data(env, request)
            return json_response(
                export_payload,
                request=request,
                env=env,
                extra_headers={
                    'cache-control': 'no-store',
                    'content-disposition': (
                        'attachment; filename="studyplanner-data-export.json"'
                    ),
                },
            )

        if path == "/api/me/account":
            if method != "DELETE":
                return _method_not_allowed_response(request, env)
            await delete_current_user_account(
                env,
                request,
                await read_json_object(request),
            )
            return empty_response(
                request=request,
                env=env,
                extra_headers={
                    'cache-control': 'no-store',
                    'set-cookie': clear_auth_cookie(request),
                },
            )

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

        if path.startswith("/api/me/course-reviews/"):
            own_review_course_id = _parse_numeric_path_id(
                path.removeprefix("/api/me/course-reviews/")
            )
            if own_review_course_id is None:
                return error_response(
                    code="invalid_course_id",
                    message="Course ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )

            if method == "PUT":
                await enforce_rate_limit(env, request, COURSE_REVIEW_POLICY)
                return json_response(
                    await save_course_review(
                        env,
                        request,
                        own_review_course_id,
                        await read_json_object(request),
                    ),
                    request=request,
                    env=env,
                )
            if method == "DELETE":
                return json_response(
                    await delete_course_review(env, request, own_review_course_id),
                    request=request,
                    env=env,
                )
            return _method_not_allowed_response(request, env)

        if path == "/api/admin/course-reviews":
            if method != "GET":
                return _method_not_allowed_response(request, env)
            return json_response(
                await list_reviews_for_moderation(env, request),
                request=request,
                env=env,
            )

        if path == "/api/admin/review-notices":
            if method != "GET":
                return _method_not_allowed_response(request, env)
            return json_response(
                await list_review_notices(env, request),
                request=request,
                env=env,
            )

        if path.startswith("/api/admin/review-notices/"):
            if method != "PATCH":
                return _method_not_allowed_response(request, env)
            notice_id = _parse_numeric_path_id(
                path.removeprefix("/api/admin/review-notices/")
            )
            if notice_id is None:
                return error_response(
                    code="invalid_review_notice_id",
                    message="Review notice ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )
            return json_response(
                await decide_review_notice(
                    env,
                    request,
                    notice_id,
                    await read_json_object(request),
                ),
                request=request,
                env=env,
            )

        if path.startswith("/api/admin/course-reviews/"):
            if method != "PATCH":
                return _method_not_allowed_response(request, env)

            moderated_review_id = _parse_numeric_path_id(
                path.removeprefix("/api/admin/course-reviews/")
            )
            if moderated_review_id is None:
                return error_response(
                    code="invalid_review_id",
                    message="Review ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )

            return json_response(
                await set_review_visibility(
                    env,
                    request,
                    moderated_review_id,
                    await read_json_object(request),
                ),
                request=request,
                env=env,
            )

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

        if path == "/api/me/transcript-data":
            if method != "DELETE":
                return _method_not_allowed_response(request, env)

            transcript_data = await clear_current_user_transcript_data(env, request)
            return json_response(transcript_data, request=request, env=env)

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

        if path == "/api/me/anrechnung/optimize":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            optimization = await get_current_user_anrechnung_optimization(env, request)
            return json_response(optimization, request=request, env=env)

        if path == "/api/client-errors":
            if method == "POST":
                await enforce_rate_limit(env, request, CLIENT_ERROR_POLICY)
                result = await report_client_error(env, request, await read_json_object(request))
                return json_response(result, request=request, env=env, status=201)

            if method == "GET":
                user = await get_authenticated_user(env, request)
                if user is None:
                    raise AuthorizationError('Authentication is required for server diagnostics.')
                errors = await list_client_errors(env, str(user['username']))
                return json_response(errors, request=request, env=env)

            return _method_not_allowed_response(request, env)

        if path == "/api/course-review-notices":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            await enforce_rate_limit(env, request, REVIEW_NOTICE_POLICY)
            notice = await submit_review_notice(
                env,
                request,
                await read_json_object(request),
            )
            return json_response(notice, request=request, env=env, status=201)

        if path == "/api/feedback":
            if method != "POST":
                return _method_not_allowed_response(request, env)

            await enforce_rate_limit(env, request, FEEDBACK_POLICY)
            feedback = await submit_feedback(env, request, await read_json_object(request))
            return json_response(feedback, request=request, env=env, status=201)

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
                        "transcriptData": "/api/me/transcript-data",
                        "semesterPlans": "/api/me/semester-plans",
                        "semesterPlanBalance": "/api/me/semester-plans/<semester_label>/balance",
                        "progress": "/api/me/progress",
                        "anrechnungOptimize": "/api/me/anrechnung/optimize",
                        "feedback": "/api/feedback",
                        "config": "/api/config",
                        "courses": "/api/courses?limit=50",
                        "courseDetail": "/api/courses/<id>",
                        "catalogPeriods": "/api/catalog/periods",
                        "catalogCourses": "/api/catalog/courses?limit=100&period=<periodId|all>",
                        "catalogCourseDetail": "/api/catalog/courses/<id>",
                        "catalogCourseReviews": "/api/catalog/courses/<id>/reviews",
                        "ownCourseReview": "/api/me/course-reviews/<courseId>",
                        "courseReviewNotices": "/api/course-review-notices",
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

        if path == "/api/config":
            simulated_semester_label = await get_simulated_semester_label(env)
            return json_response(
                {"simulatedSemesterLabel": simulated_semester_label},
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
                extra_headers=_PUBLIC_CATALOG_CACHE_HEADERS,
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
                extra_headers=_PUBLIC_CATALOG_CACHE_HEADERS,
            )

        # Must precede the catalog detail branch below, which would otherwise
        # swallow the reviews sub-path.
        if path.startswith("/api/catalog/courses/") and path.endswith("/reviews"):
            if method != "GET":
                return _method_not_allowed_response(request, env)

            review_course_id = _parse_numeric_path_id(
                path.removeprefix("/api/catalog/courses/").removesuffix("/reviews")
            )
            if review_course_id is None:
                return error_response(
                    code="invalid_course_id",
                    message="Course ids must be numeric.",
                    request=request,
                    env=env,
                    status=400,
                )

            # Deliberately uncached: the public catalog cache headers would hide
            # a new review behind a 15-minute edge cache.
            return json_response(
                await get_course_reviews(env, request, review_course_id),
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

            return json_response(
                course_detail,
                request=request,
                env=env,
                extra_headers=_PUBLIC_CATALOG_CACHE_HEADERS,
            )

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
    except AccountDeletionError as exc:
        return error_response(
            code="account_deletion_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except DataExportError as exc:
        return error_response(
            code="data_export_error",
            message=str(exc),
            request=request,
            env=env,
            status=500,
            extra_headers={'cache-control': 'no-store'},
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
    except FeedbackSubmissionError as exc:
        return error_response(
            code="feedback_submission_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except ClientErrorLogError as exc:
        return error_response(
            code="client_error_log_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except CourseReviewError as exc:
        return error_response(
            code="course_review_error",
            message=str(exc),
            request=request,
            env=env,
            status=400,
        )
    except CourseReviewNotFoundError as exc:
        return error_response(
            code="course_review_not_found",
            message=str(exc),
            request=request,
            env=env,
            status=404,
        )
    except CourseReviewAccessError as exc:
        return error_response(
            code="course_review_forbidden",
            message=str(exc),
            request=request,
            env=env,
            status=403,
        )
    except RateLimitError as exc:
        return error_response(
            code="rate_limited",
            message=str(exc),
            request=request,
            env=env,
            status=429,
            extra_headers={'retry-after': str(exc.retry_after_seconds)},
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
    except CsrfProtectionError as exc:
        return error_response(
            code="csrf_validation_failed",
            message=str(exc),
            request=request,
            env=env,
            status=403,
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
