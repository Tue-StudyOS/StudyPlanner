from __future__ import annotations

from typing import Any

from services.authentication import require_authenticated_user
from services.user_data import (
    load_user_progress_json,
    now_unix,
    parse_json_array,
    update_user_progress_json,
)


class TranscriptIssueUpdateError(ValueError):
    """Raised when transcript-issue persistence input is invalid."""


class TranscriptIssuePayload(dict[str, Any]):
    pass


def _normalize_issue_payload(payload: Any) -> TranscriptIssuePayload:
    if not isinstance(payload, dict):
        raise TranscriptIssueUpdateError('Each transcript issue must be a JSON object.')

    issue_id = str(payload.get('id') or '').strip()
    if not issue_id:
        raise TranscriptIssueUpdateError('Each transcript issue requires an id.')

    candidate = payload.get('candidate')
    if not isinstance(candidate, dict):
        raise TranscriptIssueUpdateError('Each transcript issue requires a candidate object.')

    return TranscriptIssuePayload(id=issue_id, candidate=candidate)


def _serialize_stored_issue(raw_issue: Any) -> dict[str, Any] | None:
    if not isinstance(raw_issue, dict):
        return None
    issue_id = str(raw_issue.get('id') or '').strip()
    candidate = raw_issue.get('candidate')
    if not issue_id or not isinstance(candidate, dict):
        return None
    try:
        updated_at_unix = int(raw_issue.get('updatedAtUnix') or 0)
    except (TypeError, ValueError):
        updated_at_unix = 0
    return {
        'id': issue_id,
        'candidate': candidate,
        'updatedAtUnix': updated_at_unix,
    }


async def _load_transcript_issues(env: Any, username: str) -> list[dict[str, Any]]:
    stored_value = await load_user_progress_json(env, username, 'transcript_review_items_json')
    transcript_issues = [
        serialized_issue
        for raw_issue in parse_json_array(stored_value)
        if (serialized_issue := _serialize_stored_issue(raw_issue)) is not None
    ]
    transcript_issues.sort(key=lambda issue: (-int(issue.get('updatedAtUnix') or 0), str(issue.get('id') or '')))
    return transcript_issues


async def get_current_user_transcript_issues(env: Any, request: Any) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    transcript_issues = await _load_transcript_issues(env, str(user['username']))
    return {
        'transcriptIssues': transcript_issues,
        'count': len(transcript_issues),
    }


async def replace_current_user_transcript_issues(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    user = await require_authenticated_user(env, request)
    username = str(user['username'])

    raw_transcript_issues = payload.get('transcriptIssues')
    if raw_transcript_issues is None:
        raise TranscriptIssueUpdateError('A transcriptIssues array is required.')
    if not isinstance(raw_transcript_issues, list):
        raise TranscriptIssueUpdateError('transcriptIssues must be an array.')

    current_unix = now_unix()
    transcript_issues = [
        {
            'id': issue['id'],
            'candidate': issue['candidate'],
            'updatedAtUnix': current_unix,
        }
        for issue in [_normalize_issue_payload(item) for item in raw_transcript_issues]
    ]
    await update_user_progress_json(
        env,
        username,
        'transcript_review_items_json',
        transcript_issues,
    )

    return await get_current_user_transcript_issues(env, request)
