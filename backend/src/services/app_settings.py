from __future__ import annotations

from typing import Any

from db.d1 import D1ExecutionError, fetch_one, has_database

# Key for the deploy-time "simulated current semester" toggle used to live-test
# the onboarding flow against an upcoming-winter catalog.
SIMULATED_SEMESTER_KEY = "simulated_current_semester_label"


async def get_app_setting(env: Any, key: str) -> str | None:
    """Return a runtime setting value, or None when unset or unavailable."""
    if not has_database(env):
        return None
    try:
        row = await fetch_one(
            env,
            "SELECT value FROM app_settings WHERE key = ? LIMIT 1",
            [key],
        )
    except D1ExecutionError:
        # The settings table may not exist yet (migration not applied); treat
        # that as "no setting" rather than failing the request.
        return None
    if not row:
        return None
    value = row.get("value")
    if value is None:
        return None
    text = str(value).strip()
    return text or None


async def get_simulated_semester_label(env: Any) -> str | None:
    """The simulated 'current semester' label, or None when not simulating."""
    return await get_app_setting(env, SIMULATED_SEMESTER_KEY)
