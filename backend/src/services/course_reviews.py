from __future__ import annotations

from typing import Any

from db.d1 import execute, fetch_all, fetch_one
from services.authentication import get_authenticated_user, require_authenticated_user
from services.client_error_log import is_diagnostics_administrator
from services.course_catalog import get_course_review_key, load_course_review_options
from services.retention import cleanup_expired_hidden_reviews

MIN_COMMENT_LENGTH = 3
MAX_COMMENT_LENGTH = 2000
MAX_LECTURER_NAME_LENGTH = 80
MAX_PERIOD_LABEL_LENGTH = 64
MAX_PUBLIC_REVIEWS = 200
MAX_MODERATION_REVIEWS = 200
OPTIONAL_RATING_FIELDS = ('examRating', 'contentRating', 'tutorialRating')


class CourseReviewError(ValueError):
    """Raised when review input is invalid."""


class CourseReviewNotFoundError(LookupError):
    """Raised when a review or its course does not exist."""


class CourseReviewAccessError(PermissionError):
    """Raised when a signed-in user may not moderate reviews."""


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ''


def _validate_overall_rating(value: Any) -> int:
    try:
        rating = int(value)
    except (TypeError, ValueError) as exc:
        raise CourseReviewError('overallRating must be a number from 1 to 5.') from exc
    if rating < 1 or rating > 5:
        raise CourseReviewError('overallRating must be a number from 1 to 5.')
    return rating


def _validate_optional_rating(value: Any, field_name: str) -> int | None:
    if value is None or value == '':
        return None
    try:
        rating = int(value)
    except (TypeError, ValueError) as exc:
        raise CourseReviewError(f'{field_name} must be a number from 1 to 5.') from exc
    if rating < 1 or rating > 5:
        raise CourseReviewError(f'{field_name} must be a number from 1 to 5.')
    return rating


def _validate_comment(value: Any) -> str | None:
    comment = _safe_text(value)
    if not comment:
        return None
    if len(comment) < MIN_COMMENT_LENGTH:
        raise CourseReviewError(f'comment must contain at least {MIN_COMMENT_LENGTH} characters.')
    if len(comment) > MAX_COMMENT_LENGTH:
        raise CourseReviewError(f'comment must be at most {MAX_COMMENT_LENGTH} characters.')
    return comment


def _validate_period_label(value: Any, allowed_labels: list[str]) -> str | None:
    """Only accept semesters the course was actually offered in.

    The picker is populated from the offering history, so anything else is a
    crafted payload rather than a real choice.
    """
    label = _safe_text(value)
    if not label:
        return None
    if len(label) > MAX_PERIOD_LABEL_LENGTH:
        raise CourseReviewError('takenPeriodLabel is not a known semester for this course.')
    for allowed_label in allowed_labels:
        if allowed_label.casefold() == label.casefold():
            return allowed_label
    raise CourseReviewError('takenPeriodLabel is not a known semester for this course.')


def _validate_lecturer(
    payload: dict[str, Any],
    allowed_lecturers: list[str],
) -> tuple[str | None, str | None]:
    """Split the lecturer choice into a known name or free text, never both."""
    picked_name = _safe_text(payload.get('lecturerName'))
    custom_name = _safe_text(payload.get('lecturerCustomName'))

    if picked_name and custom_name:
        raise CourseReviewError('Provide either lecturerName or lecturerCustomName, not both.')

    if picked_name:
        for allowed_lecturer in allowed_lecturers:
            if allowed_lecturer.casefold() == picked_name.casefold():
                return allowed_lecturer, None
        raise CourseReviewError('lecturerName is not a known lecturer for this course.')

    if custom_name:
        if len(custom_name) > MAX_LECTURER_NAME_LENGTH:
            raise CourseReviewError(
                f'lecturerCustomName must be at most {MAX_LECTURER_NAME_LENGTH} characters.'
            )
        return None, custom_name

    return None, None


def build_review_input(
    payload: dict[str, Any],
    options: dict[str, list[str]],
) -> dict[str, Any]:
    """Validate a submitted review against what the course actually offers."""
    lecturer_name, lecturer_custom_name = _validate_lecturer(
        payload,
        options.get('lecturers', []),
    )
    return {
        'overallRating': _validate_overall_rating(payload.get('overallRating')),
        'examRating': _validate_optional_rating(payload.get('examRating'), 'examRating'),
        'contentRating': _validate_optional_rating(payload.get('contentRating'), 'contentRating'),
        'tutorialRating': _validate_optional_rating(
            payload.get('tutorialRating'), 'tutorialRating'
        ),
        'comment': _validate_comment(payload.get('comment')),
        'takenPeriodLabel': _validate_period_label(
            payload.get('takenPeriodLabel'),
            options.get('periodLabels', []),
        ),
        'lecturerName': lecturer_name,
        'lecturerCustomName': lecturer_custom_name,
    }


def _average(values: list[int]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)


def build_review_summary(rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate visible reviews into the headline number and its breakdown.

    Pure so the aggregation stays testable without a database; the row count per
    course is bounded by how many students took it, so aggregating in Python
    avoids a second round trip.
    """
    overall_ratings = [
        rating
        for row in rows
        if (rating := _optional_int(row.get('overallRating'))) is not None
    ]
    breakdown = {str(star): 0 for star in range(1, 6)}
    for rating in overall_ratings:
        breakdown[str(rating)] += 1

    return {
        'average': _average(overall_ratings),
        'count': len(overall_ratings),
        'breakdown': breakdown,
        'examAverage': _average(_collect_ratings(rows, 'examRating')),
        'contentAverage': _average(_collect_ratings(rows, 'contentRating')),
        'tutorialAverage': _average(_collect_ratings(rows, 'tutorialRating')),
    }


def _collect_ratings(rows: list[dict[str, Any]], field_name: str) -> list[int]:
    return [
        rating
        for row in rows
        if (rating := _optional_int(row.get(field_name))) is not None
    ]


def _optional_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _to_public_review(row: dict[str, Any], viewer_username: str | None) -> dict[str, Any]:
    """Strip the author before a review leaves the server.

    username exists only for dedup and ownership; reviews are displayed
    anonymously, so it must never appear in a response.
    """
    author_username = _safe_text(row.get('username'))
    return {
        'id': _optional_int(row.get('id')),
        'overallRating': _optional_int(row.get('overallRating')),
        'examRating': _optional_int(row.get('examRating')),
        'contentRating': _optional_int(row.get('contentRating')),
        'tutorialRating': _optional_int(row.get('tutorialRating')),
        'comment': _safe_text(row.get('comment')) or None,
        'takenPeriodLabel': _safe_text(row.get('takenPeriodLabel')) or None,
        'lecturerName': _safe_text(row.get('lecturerName'))
        or _safe_text(row.get('lecturerCustomName'))
        or None,
        'createdAtUnix': _optional_int(row.get('createdAtUnix')),
        'updatedAtUnix': _optional_int(row.get('updatedAtUnix')),
        'isMine': bool(viewer_username) and author_username == viewer_username,
    }


async def _fetch_visible_reviews(env: Any, review_key: str) -> list[dict[str, Any]]:
    return await fetch_all(
        env,
        """
        SELECT
            id,
            username,
            overall_rating AS overallRating,
            exam_rating AS examRating,
            content_rating AS contentRating,
            tutorial_rating AS tutorialRating,
            comment,
            taken_period_label AS takenPeriodLabel,
            lecturer_name AS lecturerName,
            lecturer_custom_name AS lecturerCustomName,
            created_at_unix AS createdAtUnix,
            updated_at_unix AS updatedAtUnix
        FROM course_reviews
        WHERE course_key = ?
          AND is_hidden = 0
        ORDER BY updated_at_unix DESC, id DESC
        """,
        [review_key],
    )


async def _require_review_key(env: Any, course_id: int) -> str:
    review_key = await get_course_review_key(env, course_id)
    if not review_key:
        raise CourseReviewNotFoundError('No course exists for the requested id.')
    return review_key


async def get_course_reviews(env: Any, request: Any, course_id: int) -> dict[str, Any]:
    """Return the public review list, its aggregate, and the form's options."""
    review_key = await _require_review_key(env, course_id)
    rows = await _fetch_visible_reviews(env, review_key)

    # The read stays public, so resolve the session without requiring one; it
    # only decides which review the viewer is allowed to edit.
    viewer_username: str | None = None
    user = await get_authenticated_user(env, request)
    if user:
        viewer_username = _safe_text(user.get('username')) or None

    reviews = [_to_public_review(row, viewer_username) for row in rows]
    viewer_review = next((review for review in reviews if review['isMine']), None)

    return {
        'summary': build_review_summary(rows),
        'reviews': reviews[:MAX_PUBLIC_REVIEWS],
        'options': await load_course_review_options(env, course_id),
        'viewerReview': viewer_review,
    }


async def save_course_review(
    env: Any,
    request: Any,
    course_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Insert or replace the caller's single review for this course."""
    user = await require_authenticated_user(env, request)
    username = _safe_text(user.get('username'))
    review_key = await _require_review_key(env, course_id)
    options = await load_course_review_options(env, course_id)
    review_input = build_review_input(payload, options)

    await execute(
        env,
        """
        INSERT INTO course_reviews (
            course_key, username, overall_rating, exam_rating, content_rating,
            tutorial_rating, comment, taken_period_label, lecturer_name, lecturer_custom_name
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(course_key, username) DO UPDATE SET
            overall_rating = excluded.overall_rating,
            exam_rating = excluded.exam_rating,
            content_rating = excluded.content_rating,
            tutorial_rating = excluded.tutorial_rating,
            comment = excluded.comment,
            taken_period_label = excluded.taken_period_label,
            lecturer_name = excluded.lecturer_name,
            lecturer_custom_name = excluded.lecturer_custom_name,
            updated_at_unix = unixepoch()
        """,
        [
            review_key,
            username,
            review_input['overallRating'],
            review_input['examRating'],
            review_input['contentRating'],
            review_input['tutorialRating'],
            review_input['comment'],
            review_input['takenPeriodLabel'],
            review_input['lecturerName'],
            review_input['lecturerCustomName'],
        ],
    )

    return await get_course_reviews(env, request, course_id)


async def delete_course_review(env: Any, request: Any, course_id: int) -> dict[str, Any]:
    """Delete the caller's own review; other authors' rows are untouched."""
    user = await require_authenticated_user(env, request)
    username = _safe_text(user.get('username'))
    review_key = await _require_review_key(env, course_id)

    await execute(
        env,
        'DELETE FROM course_reviews WHERE course_key = ? AND username = ?',
        [review_key, username],
    )

    return await get_course_reviews(env, request, course_id)


async def list_reviews_for_moderation(env: Any, request: Any) -> dict[str, Any]:
    """List every review, hidden ones included, for a configured operator."""
    await _require_moderator(env, request)
    await cleanup_expired_hidden_reviews(env)
    entries = await fetch_all(
        env,
        """
        SELECT
            id,
            course_key AS courseKey,
            overall_rating AS overallRating,
            comment,
            taken_period_label AS takenPeriodLabel,
            lecturer_name AS lecturerName,
            lecturer_custom_name AS lecturerCustomName,
            is_hidden AS isHidden,
            created_at_unix AS createdAtUnix,
            updated_at_unix AS updatedAtUnix
        FROM course_reviews
        ORDER BY id DESC
        LIMIT ?
        """,
        [MAX_MODERATION_REVIEWS],
    )
    return {'entries': entries}


async def set_review_visibility(
    env: Any,
    request: Any,
    review_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Hide or restore a single review as a configured operator."""
    await _require_moderator(env, request)
    is_hidden = payload.get('isHidden')
    if not isinstance(is_hidden, bool):
        raise CourseReviewError('isHidden must be a boolean.')

    await cleanup_expired_hidden_reviews(env)

    existing = await fetch_one(
        env,
        'SELECT id FROM course_reviews WHERE id = ?',
        [review_id],
    )
    if existing is None:
        raise CourseReviewNotFoundError('No review exists for the requested id.')

    await execute(
        env,
        'UPDATE course_reviews SET is_hidden = ?, updated_at_unix = unixepoch() WHERE id = ?',
        [1 if is_hidden else 0, review_id],
    )
    return {'id': review_id, 'isHidden': is_hidden}


async def _require_moderator(env: Any, request: Any) -> str:
    user = await require_authenticated_user(env, request)
    username = _safe_text(user.get('username'))
    if not is_diagnostics_administrator(env, username):
        raise CourseReviewAccessError('Review moderation is limited to configured operators.')
    return username


__all__ = [
    'CourseReviewAccessError',
    'CourseReviewError',
    'CourseReviewNotFoundError',
    'build_review_input',
    'build_review_summary',
    'delete_course_review',
    'get_course_reviews',
    'list_reviews_for_moderation',
    'save_course_review',
    'set_review_visibility',
]
