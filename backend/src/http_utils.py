from __future__ import annotations

import json
from typing import Any

from workers import Response

from env_config import get_allowed_origins, is_origin_allowed


def get_request_header(request: Any, header_name: str) -> str | None:
    headers = getattr(request, "headers", None)
    if headers is None:
        return None

    getter = getattr(headers, "get", None)
    if callable(getter):
        value = getter(header_name)
        if value is None:
            value = getter(header_name.lower())
        if value is None:
            return None
        return str(value)

    return None


def build_cors_headers(request: Any, env: Any) -> dict[str, str]:
    """Build CORS headers based on the configured allow-list."""
    allowed_origins = get_allowed_origins(env)
    request_origin = get_request_header(request, "Origin")

    headers: dict[str, str] = {
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type",
    }

    if "*" in allowed_origins:
        headers["access-control-allow-origin"] = "*"
    elif is_origin_allowed(request_origin, allowed_origins):
        headers["access-control-allow-origin"] = request_origin or ""
        headers["vary"] = "Origin"

    return headers


def json_response(
    payload: Any,
    request: Any,
    env: Any,
    status: int = 200,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Create a JSON response with shared headers and CORS support."""
    headers = {
        "content-type": "application/json; charset=utf-8",
        **build_cors_headers(request, env),
    }
    if extra_headers:
        headers.update(extra_headers)

    body = json.dumps(payload, ensure_ascii=False)
    return Response(body, status=status, headers=headers)


def empty_response(
    request: Any,
    env: Any,
    status: int = 204,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Create an empty response for preflight requests."""
    headers = build_cors_headers(request, env)
    if extra_headers:
        headers.update(extra_headers)
    return Response("", status=status, headers=headers)


def error_response(
    code: str,
    message: str,
    request: Any,
    env: Any,
    status: int,
) -> Response:
    """Create a JSON error response."""
    return json_response(
        {
            "error": code,
            "message": message,
        },
        request=request,
        env=env,
        status=status,
    )
