from __future__ import annotations

from typing import Any

DEFAULT_ALLOWED_ORIGINS: set[str] = {"http://localhost:5173"}


def get_env_value(env: Any, key: str, default: str | None = None) -> str | None:
    """Read a string value from the Cloudflare env object."""
    if isinstance(env, dict):
        value = env.get(key)
    else:
        value = getattr(env, key, None)

    if value is None:
        return default
    if isinstance(value, str):
        return value
    return str(value)


def get_allowed_origins(env: Any) -> set[str]:
    """Return the configured CORS allow-list."""
    raw_origins = get_env_value(
        env,
        "ALLOWED_ORIGINS",
        ",".join(sorted(DEFAULT_ALLOWED_ORIGINS)),
    )
    if not raw_origins:
        return set(DEFAULT_ALLOWED_ORIGINS)

    allowed_origins = {
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    }
    return allowed_origins or set(DEFAULT_ALLOWED_ORIGINS)


def is_origin_allowed(origin: str | None, allowed_origins: set[str]) -> bool:
    """Check whether a request origin is allowed to call the API."""
    if not origin:
        return False
    return "*" in allowed_origins or origin in allowed_origins
