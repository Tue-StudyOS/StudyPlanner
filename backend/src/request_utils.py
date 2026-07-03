from __future__ import annotations

import json
from typing import Any


class RequestBodyError(ValueError):
    """Raised when the request body is missing or invalid."""


async def read_json_object(request: Any) -> dict[str, Any]:
    """Read the request body once, then parse JSON.

    Python Workers may expose both ``json()`` and ``text()`` on the same
    stream; calling ``json()`` first and falling back to ``text()`` triggers
    "Body already used" on POST routes such as login.
    """
    text_method = getattr(request, 'text', None)
    if not callable(text_method):
        raise RequestBodyError('The runtime does not expose a readable request body.')

    try:
        raw_body = await text_method()
    except Exception as exc:  # pragma: no cover - runtime-specific integration
        raise RequestBodyError(f'Failed to read the request body: {exc}') from exc

    if raw_body is None:
        return {}

    normalized_body = str(raw_body).strip()
    if not normalized_body:
        return {}

    try:
        payload = json.loads(normalized_body)
    except json.JSONDecodeError as exc:
        raise RequestBodyError('Request body must be valid JSON.') from exc

    if not isinstance(payload, dict):
        raise RequestBodyError('Expected a JSON object body.')

    return {str(key): value for key, value in payload.items()}
