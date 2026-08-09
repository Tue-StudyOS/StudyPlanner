from __future__ import annotations

from typing import Any

from db.d1 import execute_batch, fetch_all_batch
from services.authentication import require_authenticated_user, verify_user_password
from services.request_rate_limit import AUTH_LOGIN_POLICY, account_rate_limit_key
from services.user_data import now_unix, parse_json_array, parse_json_object

ACCOUNT_DELETION_CONFIRMATION = 'DELETE'
DATA_EXPORT_VERSION = 1


class AccountDeletionError(ValueError):
    """Raised when an account-erasure request is incomplete or cannot be verified."""


class DataExportError(RuntimeError):
    """Raised when authenticated account data cannot be exported consistently."""


def _first_row(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return rows[0] if rows else {}


def _build_export_payload(
    username: str,
    query_results: list[list[dict[str, Any]]],
    exported_at_unix: int,
) -> dict[str, Any]:
    if len(query_results) != 5:
        raise DataExportError('The account export could not be assembled.')

    account_row = _first_row(query_results[0])
    state_row = _first_row(query_results[1])
    progress_row = _first_row(query_results[2])
    if not account_row:
        raise DataExportError('The authenticated account no longer exists.')

    return {
        'exportVersion': DATA_EXPORT_VERSION,
        'exportedAtUnix': exported_at_unix,
        'account': {
            'username': username,
            'email': account_row.get('email'),
            'createdAtUnix': account_row.get('createdAtUnix'),
            'updatedAtUnix': account_row.get('updatedAtUnix'),
        },
        'profileAndPlanning': {
            'displayName': state_row.get('displayName'),
            'studyProgramId': state_row.get('studyProgramId'),
            'regulationVersionId': state_row.get('regulationVersionId'),
            'currentSemesterLabel': state_row.get('currentSemesterLabel'),
            'plannerMobileMode': state_row.get('plannerMobileMode'),
            'plannerMobileLayout': state_row.get('plannerMobileLayout'),
            'favorites': parse_json_array(state_row.get('favoritesJson')),
            'semesterPlans': parse_json_object(state_row.get('semesterPlansJson')),
            'settings': parse_json_object(state_row.get('settingsJson')),
            'createdAtUnix': state_row.get('createdAtUnix'),
            'updatedAtUnix': state_row.get('updatedAtUnix'),
        },
        'academicProgress': {
            'completedCourses': parse_json_array(progress_row.get('completedCoursesJson')),
            'transcriptReviewItems': parse_json_array(
                progress_row.get('transcriptReviewItemsJson')
            ),
            'createdAtUnix': progress_row.get('createdAtUnix'),
            'updatedAtUnix': progress_row.get('updatedAtUnix'),
        },
        'authoredCourseReviews': query_results[3],
        'linkedClientDiagnostics': query_results[4],
        'notes': {
            'credentialsExcluded': True,
            'unlinkedFeedbackAndIpRateLimits': (
                'Feedback and IP-derived rate-limit rows are not linked to an account. '
                'Use the published rights contact to identify a specific submission.'
            ),
        },
    }


async def export_current_user_data(env: Any, request: Any) -> dict[str, Any]:
    current_user = await require_authenticated_user(env, request)
    username = str(current_user['username'])
    query_results = await fetch_all_batch(
        env,
        [
            (
                """
                SELECT
                    email,
                    created_at_unix AS createdAtUnix,
                    updated_at_unix AS updatedAtUnix
                FROM user_auth
                WHERE username = ?
                LIMIT 1
                """,
                [username],
            ),
            (
                """
                SELECT
                    display_name AS displayName,
                    study_program_id AS studyProgramId,
                    regulation_version_id AS regulationVersionId,
                    current_semester_label AS currentSemesterLabel,
                    planner_mobile_mode AS plannerMobileMode,
                    planner_mobile_layout AS plannerMobileLayout,
                    favorites_json AS favoritesJson,
                    semester_plans_json AS semesterPlansJson,
                    settings_json AS settingsJson,
                    created_at_unix AS createdAtUnix,
                    updated_at_unix AS updatedAtUnix
                FROM user_state
                WHERE username = ?
                LIMIT 1
                """,
                [username],
            ),
            (
                """
                SELECT
                    completed_courses_json AS completedCoursesJson,
                    transcript_review_items_json AS transcriptReviewItemsJson,
                    created_at_unix AS createdAtUnix,
                    updated_at_unix AS updatedAtUnix
                FROM user_progress
                WHERE username = ?
                LIMIT 1
                """,
                [username],
            ),
            (
                """
                SELECT
                    id,
                    course_key AS courseKey,
                    overall_rating AS overallRating,
                    exam_rating AS examRating,
                    content_rating AS contentRating,
                    tutorial_rating AS tutorialRating,
                    comment,
                    taken_period_label AS takenPeriodLabel,
                    lecturer_name AS lecturerName,
                    lecturer_custom_name AS lecturerCustomName,
                    is_hidden AS isHidden,
                    created_at_unix AS createdAtUnix,
                    updated_at_unix AS updatedAtUnix
                FROM course_reviews
                WHERE username = ?
                ORDER BY created_at_unix ASC, id ASC
                """,
                [username],
            ),
            (
                """
                SELECT
                    id,
                    method,
                    url,
                    status,
                    code,
                    message,
                    detail,
                    duration_ms AS durationMs,
                    page_path AS pagePath,
                    created_at_unix AS createdAtUnix
                FROM client_error_log
                WHERE user_username = ?
                ORDER BY created_at_unix ASC, id ASC
                """,
                [username],
            ),
        ],
    )
    return _build_export_payload(username, query_results, now_unix())


def _account_rate_limit_keys(username: str, email: str) -> list[str]:
    keys = {
        key
        for identifier in (username, email)
        if (key := account_rate_limit_key(identifier)) is not None
    }
    return sorted(keys)


async def delete_current_user_account(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> None:
    current_user = await require_authenticated_user(env, request)
    username = str(current_user['username'])
    email = str(current_user.get('email') or username)

    if payload.get('confirmation') != ACCOUNT_DELETION_CONFIRMATION:
        raise AccountDeletionError(
            f'Type {ACCOUNT_DELETION_CONFIRMATION} to confirm account deletion.'
        )
    current_password = payload.get('currentPassword')
    if not await verify_user_password(env, username, current_password):
        raise AccountDeletionError('Current password is incorrect.')

    rate_limit_keys = _account_rate_limit_keys(username, email)
    if len(rate_limit_keys) == 1:
        rate_limit_keys.append(rate_limit_keys[0])

    await execute_batch(
        env,
        [
            (
                'UPDATE client_error_log SET user_username = NULL WHERE user_username = ?',
                [username],
            ),
            (
                """
                DELETE FROM request_rate_limits
                WHERE scope = ? AND client_key IN (?, ?)
                """,
                [AUTH_LOGIN_POLICY.scope, rate_limit_keys[0], rate_limit_keys[1]],
            ),
            ('DELETE FROM user_auth WHERE username = ?', [username]),
        ],
    )
