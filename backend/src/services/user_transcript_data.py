from __future__ import annotations

from typing import Any

from services.authentication import require_authenticated_user
from services.user_data import update_user_progress_json


async def clear_current_user_transcript_data(env: Any, request: Any) -> dict[str, Any]:
    """Remove every account-owned transcript artifact in one backend operation."""
    user = await require_authenticated_user(env, request)
    username = str(user['username'])

    await update_user_progress_json(env, username, 'completed_courses_json', [])
    await update_user_progress_json(env, username, 'transcript_review_items_json', [])

    return {
        'completedCourses': [],
        'transcriptIssues': [],
        'completedCourseCount': 0,
        'transcriptIssueCount': 0,
    }
