"""Shared redaction for browser reports and structured server failures."""

from __future__ import annotations

import re
from typing import Any

SENSITIVE_FIELD_PATTERN = re.compile(
    r'''\b(password|passwd|token|secret|csrf)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;]+)''',
    re.IGNORECASE,
)
BEARER_PATTERN = re.compile(r'\bBearer\s+[A-Za-z0-9._~+/=-]+', re.IGNORECASE)
HEADER_PATTERN = re.compile(
    r'\b(cookie|set-cookie|authorization)[\"\']?\s*[:=]\s*[^\r\n]+',
    re.IGNORECASE,
)
EMAIL_PATTERN = re.compile(r'\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b', re.IGNORECASE)
ACADEMIC_DATA_PATTERN = re.compile(
    r'\b(transcript(?:\s+text)?|zeugnis|grade|note)[\"\']?\s*[:=]\s*[^\r\n,;]+',
    re.IGNORECASE,
)
URL_QUERY_PATTERN = re.compile(r'(https?://[^\s?#]+)\?[^\s#]*', re.IGNORECASE)


def safe_exception_summary(exception: Exception | None) -> str | None:
    if exception is None:
        return None
    message = str(exception)
    # Only static runtime signatures/schema identifiers are allowed. Arbitrary
    # exception values can contain student data that regex redaction cannot know.
    database_error = re.search(
        r'(?:no such (?:table|column)|UNIQUE constraint failed|NOT NULL constraint failed): '
        r'[A-Za-z_][A-Za-z0-9_.]{0,80}', message,
    )
    if database_error:
        return database_error.group(0)
    for signature in (
        "Missing D1 binding 'DB'.", 'FOREIGN KEY constraint failed',
        'Worker exceeded CPU time limit', 'code had hung',
        'Attempted to use PyProxy when Python GIL not held',
        'Received non-dedicated snapshot',
    ):
        if signature in message:
            return signature
    return None


def redact_diagnostic_text(value: Any, *, max_length: int) -> str:
    text = str(value).strip()[:max_length * 2] if value is not None else ''
    text = URL_QUERY_PATTERN.sub(r'\1?[redacted-query]', text)
    text = BEARER_PATTERN.sub('Bearer [redacted-token]', text)
    text = HEADER_PATTERN.sub(r'\1: [redacted]', text)
    text = SENSITIVE_FIELD_PATTERN.sub(r'\1: [redacted]', text)
    text = ACADEMIC_DATA_PATTERN.sub(r'\1: [redacted-academic-data]', text)
    text = EMAIL_PATTERN.sub('[redacted-email]', text)
    return text[:max_length]
