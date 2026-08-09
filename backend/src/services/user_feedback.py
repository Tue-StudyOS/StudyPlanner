from __future__ import annotations

from typing import Any

from db.d1 import execute, fetch_one

MAX_MESSAGE_LENGTH = 2000
MIN_MESSAGE_LENGTH = 3
MAX_PAGE_PATH_LENGTH = 512
ALLOWED_SOURCES = {'auto_prompt', 'feedback_button'}


class FeedbackSubmissionError(ValueError):
    """Raised when public feedback input is invalid."""


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ''


def _validate_rating(value: Any) -> int:
    try:
        rating = int(value)
    except (TypeError, ValueError) as exc:
        raise FeedbackSubmissionError('rating must be a number from 1 to 5.') from exc

    if rating < 1 or rating > 5:
        raise FeedbackSubmissionError('rating must be a number from 1 to 5.')
    return rating


def _validate_message(value: Any) -> str:
    message = _safe_text(value)
    if len(message) < MIN_MESSAGE_LENGTH:
        raise FeedbackSubmissionError('message must contain at least 3 characters.')
    if len(message) > MAX_MESSAGE_LENGTH:
        raise FeedbackSubmissionError(f'message must be at most {MAX_MESSAGE_LENGTH} characters.')
    return message


def _validate_page_path(value: Any) -> str:
    page_path = _safe_text(value) or '/'
    if len(page_path) > MAX_PAGE_PATH_LENGTH:
        return page_path[:MAX_PAGE_PATH_LENGTH]
    return page_path


def _validate_source(value: Any) -> str:
    source = _safe_text(value) or 'feedback_button'
    if source not in ALLOWED_SOURCES:
        raise FeedbackSubmissionError('source must be auto_prompt or feedback_button.')
    return source


async def submit_feedback(env: Any, request: Any, payload: dict[str, Any]) -> dict[str, Any]:
    del request
    rating = _validate_rating(payload.get('rating'))
    message = _validate_message(payload.get('message'))
    page_path = _validate_page_path(payload.get('pagePath'))
    source = _validate_source(payload.get('source'))

    await execute(
        env,
        "DELETE FROM user_feedback WHERE created_at_unix < unixepoch('now', '-6 months')",
    )

    await execute(
        env,
        """
        INSERT INTO user_feedback (rating, message, page_path, source)
        VALUES (?, ?, ?, ?)
        """,
        [rating, message, page_path, source],
    )

    row = await fetch_one(env, 'SELECT last_insert_rowid() AS id')
    feedback_id = int(row['id']) if row and row.get('id') is not None else 0
    created_row = await fetch_one(
        env,
        'SELECT created_at_unix AS createdAtUnix FROM user_feedback WHERE id = ?',
        [feedback_id],
    )

    return {
        'feedback': {
            'id': feedback_id,
            'rating': rating,
            'createdAtUnix': created_row.get('createdAtUnix') if created_row else None,
        }
    }
