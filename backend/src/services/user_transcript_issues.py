from __future__ import annotations

import json
import time
from typing import Any

from db.d1 import execute, fetch_all
from services.authentication import require_authenticated_user


class TranscriptIssueUpdateError(ValueError):
    """Raised when transcript-issue persistence input is invalid."""


class TranscriptIssuePayload(dict[str, Any]):
    pass


async def _ensure_transcript_issues_table(env: Any) -> None:
    await execute(
        env,
        """
        CREATE TABLE IF NOT EXISTS user_transcript_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            issue_key TEXT NOT NULL,
            candidate_json TEXT NOT NULL,
            created_at_unix INTEGER NOT NULL,
            updated_at_unix INTEGER NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, issue_key)
        )
        """,
    )
    await execute(
        env,
        """
        CREATE INDEX IF NOT EXISTS idx_user_transcript_issues_user_id
        ON user_transcript_issues(user_id, updated_at_unix DESC, id ASC)
        """,
    )


def _now_unix() -> int:
    return int(time.time())


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


async def get_current_user_transcript_issues(env: Any, request: Any) -> dict[str, Any]:
    await _ensure_transcript_issues_table(env)
    user = await require_authenticated_user(env, request)
    rows = await fetch_all(
        env,
        """
        SELECT id, issue_key AS issueKey, candidate_json AS candidateJson, updated_at_unix AS updatedAtUnix
        FROM user_transcript_issues
        WHERE user_id = ?
        ORDER BY updated_at_unix DESC, id ASC
        """,
        [int(user['id'])],
    )

    transcript_issues: list[dict[str, Any]] = []
    for row in rows:
        try:
            candidate = json.loads(row['candidateJson'])
        except (TypeError, ValueError):
            continue
        if not isinstance(candidate, dict):
            continue

        transcript_issues.append(
            {
                'id': str(row['issueKey']),
                'candidate': candidate,
                'updatedAtUnix': int(row['updatedAtUnix'] or 0),
            }
        )

    return {
        'transcriptIssues': transcript_issues,
        'count': len(transcript_issues),
    }


async def replace_current_user_transcript_issues(
    env: Any,
    request: Any,
    payload: dict[str, Any],
) -> dict[str, Any]:
    await _ensure_transcript_issues_table(env)
    user = await require_authenticated_user(env, request)
    user_id = int(user['id'])

    raw_transcript_issues = payload.get('transcriptIssues')
    if raw_transcript_issues is None:
        raise TranscriptIssueUpdateError('A transcriptIssues array is required.')
    if not isinstance(raw_transcript_issues, list):
        raise TranscriptIssueUpdateError('transcriptIssues must be an array.')

    transcript_issues = [_normalize_issue_payload(item) for item in raw_transcript_issues]

    await execute(env, 'DELETE FROM user_transcript_issues WHERE user_id = ?', [user_id])
    now_unix = _now_unix()

    for issue in transcript_issues:
        await execute(
            env,
            """
            INSERT INTO user_transcript_issues (
                user_id,
                issue_key,
                candidate_json,
                created_at_unix,
                updated_at_unix
            ) VALUES (?, ?, ?, ?, ?)
            """,
            [
                user_id,
                issue['id'],
                json.dumps(issue['candidate'], ensure_ascii=False, separators=(',', ':')),
                now_unix,
                now_unix,
            ],
        )

    return await get_current_user_transcript_issues(env, request)
