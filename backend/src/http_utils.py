from __future__ import annotations

import json
import re
import sys
from typing import Any
from urllib.parse import urlsplit

from workers import Response

from diagnostic_redaction import redact_diagnostic_text, safe_exception_summary
from env_config import get_allowed_origins, is_origin_allowed
from isolate_identity import get_isolate_id, isolate_age_ms, next_response_sequence


SECURITY_HEADERS: dict[str, str] = {
    "content-security-policy": (
        "default-src 'none'; base-uri 'none'; form-action 'none'; "
        "frame-ancestors 'none'; object-src 'none'"
    ),
    "permissions-policy": "camera=(), geolocation=(), microphone=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
}

HTML_CONTENT_SECURITY_POLICY = (
    "default-src 'none'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'none'; object-src 'none'; style-src 'unsafe-inline'"
)


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


def get_request_id(request: Any) -> str:
    for header in ('X-Request-ID', 'CF-Ray'):
        value = get_request_header(request, header)
        if value and re.fullmatch(r'[A-Za-z0-9_-]{1,80}', value):
            return value
    return f'{get_isolate_id()}-{id(request):x}'


def get_worker_version(env: Any) -> str | None:
    metadata = env.get('WORKER_VERSION') if isinstance(env, dict) else getattr(env, 'WORKER_VERSION', None)
    value = metadata.get('id') if isinstance(metadata, dict) else getattr(metadata, 'id', None)
    return str(value) if value else None


def log_server_failure(
    request: Any, env: Any, status: int, code: str, exception: Exception | None,
) -> None:
    # Frame locations suffice to find the failing code without logging locals,
    # source lines, request bodies, cookies, or authorization headers.
    frames: list[dict[str, Any]] = []
    current = exception.__traceback__ if exception else None
    while current is not None:
        frames.append({
            'file': current.tb_frame.f_code.co_filename.replace('\\', '/').rsplit('/', 1)[-1],
            'function': current.tb_frame.f_code.co_name,
            'line': current.tb_lineno,
        })
        current = current.tb_next
    event = {
        'event': 'server_failure',
        'requestId': get_request_id(request),
        'cfRay': get_request_header(request, 'CF-Ray'),
        'method': str(getattr(request, 'method', 'UNKNOWN'))[:16],
        'path': redact_diagnostic_text(urlsplit(str(getattr(request, 'url', '/'))).path, max_length=512),
        'status': status,
        'code': code,
        'isolateId': get_isolate_id(),
        'isolateAgeMs': isolate_age_ms(),
        'workerVersion': get_worker_version(env),
        'exceptionType': type(exception).__name__ if exception else None,
        'exceptionSummary': safe_exception_summary(exception),
        'exceptionCauseType': type(exception.__cause__).__name__ if exception and exception.__cause__ else None,
        'frames': frames[-12:],
    }
    print(json.dumps(event, ensure_ascii=False), file=sys.stderr)


def build_cors_headers(request: Any, env: Any) -> dict[str, str]:
    """Build CORS headers based on the configured allow-list."""
    allowed_origins = get_allowed_origins(env)
    request_origin = get_request_header(request, "Origin")

    headers: dict[str, str] = {
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "access-control-allow-headers": "Authorization, Content-Type, X-CSRF-Token, X-Guest-Review-Token, X-Request-ID",
        "x-request-id": get_request_id(request),
        # Diagnostic; see isolate_identity. Every response path funnels through
        # here, which is why the marker is attached at this point rather than in
        # each responder.
        "x-isolate-id": get_isolate_id(),
        "x-isolate-seq": str(next_response_sequence()),
        "x-isolate-age-ms": str(isolate_age_ms()),
        # Local development can call the Worker cross-origin.
        "access-control-expose-headers": (
            "cf-ray, x-request-id, x-error-source, x-worker-version, "
            "x-isolate-id, x-isolate-seq, x-isolate-age-ms"
        ),
    }
    worker_version = get_worker_version(env)
    if worker_version:
        headers['x-worker-version'] = worker_version

    if "*" in allowed_origins:
        headers["access-control-allow-origin"] = "*"
    elif is_origin_allowed(request_origin, allowed_origins):
        headers["access-control-allow-origin"] = request_origin or ""
        headers["access-control-allow-credentials"] = "true"
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
        **SECURITY_HEADERS,
        "content-type": "application/json; charset=utf-8",
        **build_cors_headers(request, env),
    }
    if extra_headers:
        headers.update(extra_headers)

    # Encoded here rather than handed over as `str`. Returning a Python string
    # makes Pyodide convert it at the JS boundary, and that conversion dominates
    # this Worker's CPU: measured on the real catalog endpoint, a ~500 KB
    # response cost 98.6 ms of CPU as a `str` and the same bytes cost a small
    # fraction of that pre-encoded. Avoiding repeated CPU-limit overages matters:
    # termination can leave a Python isolate unhealthy (see docs/load-test-2026-08.md).
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return Response(body, status=status, headers=headers)


def encoded_json_response(
    body: bytes,
    request: Any,
    env: Any,
    status: int = 200,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Return an already-serialised JSON body.

    Exists so a caller that has cached the encoded bytes can skip both
    `json.dumps` and the encode, which is the whole point of caching them.
    Headers are still built per request, because they carry per-isolate
    diagnostics and the CORS origin.
    """
    headers = {
        "content-type": "application/json; charset=utf-8",
        **build_cors_headers(request, env),
    }
    if extra_headers:
        headers.update(extra_headers)
    return Response(body, status=status, headers=headers)


def empty_response(
    request: Any,
    env: Any,
    status: int = 204,
    extra_headers: dict[str, str] | None = None,
) -> Response:
    """Create an empty response for preflight requests."""
    headers = {
        **SECURITY_HEADERS,
        **build_cors_headers(request, env),
    }
    if extra_headers:
        headers.update(extra_headers)
    return Response(None, status=status, headers=headers)


def html_response(html: str, status: int = 200, max_age: int = 300) -> Response:
    return Response(
        html,
        status=status,
        headers={
            **SECURITY_HEADERS,
            "content-security-policy": HTML_CONTENT_SECURITY_POLICY,
            "content-type": "text/html; charset=utf-8",
            "cache-control": f"public, max-age={max_age}",
        },
    )


def error_response(
    code: str,
    message: str,
    request: Any,
    env: Any,
    status: int,
    extra_headers: dict[str, str] | None = None,
    exception: Exception | None = None,
) -> Response:
    """Create a JSON error response; persist correlated evidence for server failures."""
    if status >= 500:
        log_server_failure(request, env, status, code, exception)
        extra_headers = {**(extra_headers or {}), 'x-error-source': 'application'}
    return json_response(
        {
            "error": code,
            "message": message,
            "requestId": get_request_id(request),
        },
        request=request,
        env=env,
        status=status,
        extra_headers=extra_headers,
    )
