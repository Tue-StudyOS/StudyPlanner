from __future__ import annotations

import json
import re
from typing import Any

from db.d1 import execute, execute_batch, fetch_all, fetch_one
from services.authentication import get_authenticated_user
from services.course_reviews import (
    CourseReviewError,
    CourseReviewNotFoundError,
    require_review_moderator,
)
from services.retention import cleanup_expired_review_notices

MAX_ALLEGATION_LENGTH = 200
MAX_EXPLANATION_LENGTH = 2000
MAX_DECISION_REASON_LENGTH = 1000
MAX_NOTICES = 200
NOTICE_CATEGORIES = {
    'illegal_content',
    'privacy',
    'harassment',
    'defamation',
    'off_topic',
    'moderation_redress',
    'other',
}
DECISION_ACTIONS = {'keep', 'hide', 'restore', 'no_action'}
DECISION_CATEGORIES = {
    'no_violation',
    'illegal_content',
    'privacy',
    'harassment',
    'defamation',
    'off_topic',
    'other',
}
EMAIL_PATTERN = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')


def _safe_text(value: Any) -> str:
    return str(value).strip() if value is not None else ''


def _required_text(value: Any, field_name: str, minimum: int, maximum: int) -> str:
    text = _safe_text(value)
    if len(text) < minimum or len(text) > maximum:
        raise CourseReviewError(
            f'{field_name} must contain {minimum} to {maximum} characters.'
        )
    return text


def build_notice_input(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        review_id = int(payload.get('reviewId'))
    except (TypeError, ValueError) as exc:
        raise CourseReviewError('reviewId must be a positive integer.') from exc
    if review_id < 1:
        raise CourseReviewError('reviewId must be a positive integer.')

    category = _safe_text(payload.get('category'))
    if category not in NOTICE_CATEGORIES:
        raise CourseReviewError('category is not a supported notice category.')

    email = _safe_text(payload.get('contactEmail')).lower()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        raise CourseReviewError('contactEmail must be a valid email address.')
    if payload.get('goodFaith') is not True:
        raise CourseReviewError('goodFaith must be confirmed.')

    return {
        'reviewId': review_id,
        'category': category,
        'allegation': _required_text(
            payload.get('allegation'),
            'allegation',
            3,
            MAX_ALLEGATION_LENGTH,
        ),
        'explanation': _required_text(
            payload.get('explanation'),
            'explanation',
            10,
            MAX_EXPLANATION_LENGTH,
        ),
        'contactEmail': email,
    }


def build_decision_input(payload: dict[str, Any]) -> dict[str, str]:
    action = _safe_text(payload.get('action'))
    category = _safe_text(payload.get('category'))
    if action not in DECISION_ACTIONS:
        raise CourseReviewError('action is not a supported moderation action.')
    if category not in DECISION_CATEGORIES:
        raise CourseReviewError('category is not a supported decision category.')
    return {
        'action': action,
        'category': category,
        'reason': _required_text(
            payload.get('reason'),
            'reason',
            10,
            MAX_DECISION_REASON_LENGTH,
        ),
    }


def _review_snapshot(row: dict[str, Any]) -> str:
    snapshot = {
        'reviewId': row.get('id'),
        'courseKey': row.get('courseKey'),
        'overallRating': row.get('overallRating'),
        'comment': row.get('comment'),
        'takenPeriodLabel': row.get('takenPeriodLabel'),
        'lecturerName': row.get('lecturerName') or row.get('lecturerCustomName'),
        'createdAtUnix': row.get('createdAtUnix'),
        'updatedAtUnix': row.get('updatedAtUnix'),
    }
    return json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'))


async def submit_review_notice(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    notice = build_notice_input(payload)
    review = await fetch_one(
        env,
        """
        SELECT
            id,
            course_key AS courseKey,
            username,
            overall_rating AS overallRating,
            comment,
            taken_period_label AS takenPeriodLabel,
            lecturer_name AS lecturerName,
            lecturer_custom_name AS lecturerCustomName,
            is_hidden AS isHidden,
            created_at_unix AS createdAtUnix,
            updated_at_unix AS updatedAtUnix
        FROM course_reviews
        WHERE id = ?
        """,
        [notice['reviewId']],
    )
    if review is None:
        raise CourseReviewNotFoundError('No review exists for the requested id.')

    is_hidden = bool(review.get('isHidden'))
    if is_hidden:
        user = await get_authenticated_user(env, request)
        is_author_redress = (
            notice['category'] == 'moderation_redress'
            and user is not None
            and _safe_text(user.get('username')) == _safe_text(review.get('username'))
        )
        if not is_author_redress:
            raise CourseReviewNotFoundError('No review exists for the requested id.')

    await cleanup_expired_review_notices(env)
    await execute(
        env,
        """
        INSERT INTO review_notices (
            review_id, course_key, review_snapshot_json, category, allegation,
            explanation, notifier_email, good_faith
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        """,
        [
            notice['reviewId'],
            _safe_text(review.get('courseKey')),
            _review_snapshot(review),
            notice['category'],
            notice['allegation'],
            notice['explanation'],
            notice['contactEmail'],
        ],
    )
    created = await fetch_one(
        env,
        """
        SELECT id, created_at_unix AS createdAtUnix
        FROM review_notices
        WHERE id = last_insert_rowid()
        """,
    )
    notice_id = int(created.get('id', 0)) if created else 0
    return {
        'notice': {
            'reference': f'RN-{notice_id}',
            'status': 'received',
            'receivedAtUnix': created.get('createdAtUnix') if created else None,
        }
    }


async def list_review_notices(env: Any, request: Any) -> dict[str, Any]:
    await require_review_moderator(env, request)
    await cleanup_expired_review_notices(env)
    rows = await fetch_all(
        env,
        """
        SELECT
            id,
            review_id AS reviewId,
            course_key AS courseKey,
            review_snapshot_json AS reviewSnapshotJson,
            category,
            allegation,
            explanation,
            notifier_email AS notifierEmail,
            status,
            decision_action AS decisionAction,
            decision_category AS decisionCategory,
            decision_reason AS decisionReason,
            moderator_username AS moderatorUsername,
            created_at_unix AS createdAtUnix,
            decided_at_unix AS decidedAtUnix
        FROM review_notices
        ORDER BY CASE status WHEN 'received' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END,
                 created_at_unix ASC
        LIMIT ?
        """,
        [MAX_NOTICES],
    )
    entries: list[dict[str, Any]] = []
    for row in rows:
        entry = dict(row)
        snapshot_json = _safe_text(entry.pop('reviewSnapshotJson', ''))
        try:
            entry['reviewSnapshot'] = json.loads(snapshot_json)
        except (TypeError, ValueError):
            entry['reviewSnapshot'] = None
        entries.append(entry)
    return {'entries': entries}


async def decide_review_notice(
    env: Any,
    request: Any,
    notice_id: int,
    payload: dict[str, Any],
) -> dict[str, Any]:
    moderator_username = await require_review_moderator(env, request)
    decision = build_decision_input(payload)
    notice = await fetch_one(
        env,
        'SELECT id, review_id AS reviewId, status FROM review_notices WHERE id = ?',
        [notice_id],
    )
    if notice is None:
        raise CourseReviewNotFoundError('No review notice exists for the requested id.')
    if _safe_text(notice.get('status')) == 'resolved':
        raise CourseReviewError('The review notice has already been resolved.')

    review_id = int(notice.get('reviewId', 0))
    review = await fetch_one(env, 'SELECT id FROM course_reviews WHERE id = ?', [review_id])
    if review is None and decision['action'] != 'no_action':
        raise CourseReviewError('Only no_action can close a notice after its review was deleted.')

    statements: list[tuple[str, list[Any]]] = [
        (
            """
            UPDATE review_notices
            SET status = 'resolved',
                decision_action = ?,
                decision_category = ?,
                decision_reason = ?,
                moderator_username = ?,
                decided_at_unix = unixepoch()
            WHERE id = ?
            """,
            [
                decision['action'],
                decision['category'],
                decision['reason'],
                moderator_username,
                notice_id,
            ],
        )
    ]
    if review is not None:
        is_hidden = decision['action'] == 'hide'
        moderation_status = (
            'hidden'
            if is_hidden
            else 'restored'
            if decision['action'] == 'restore'
            else 'reviewed'
        )
        statements.append(
            (
                """
                UPDATE course_reviews
                SET is_hidden = ?,
                    moderation_status = ?,
                    moderation_action = ?,
                    moderation_category = ?,
                    moderation_reason = ?,
                    moderated_by = ?,
                    moderated_at_unix = unixepoch(),
                    updated_at_unix = unixepoch()
                WHERE id = ?
                """,
                [
                    1 if is_hidden else 0,
                    moderation_status,
                    decision['action'],
                    decision['category'],
                    decision['reason'],
                    moderator_username,
                    review_id,
                ],
            )
        )
    await execute_batch(env, statements)
    return {'id': notice_id, 'status': 'resolved', **decision}


__all__ = [
    'build_decision_input',
    'build_notice_input',
    'decide_review_notice',
    'list_review_notices',
    'submit_review_notice',
]
