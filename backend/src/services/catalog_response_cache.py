"""Per-isolate cache of already-serialised catalog responses.

Why this exists
---------------
On the Workers Free plan each isolate is killed once it has accumulated about
2000 ms of CPU *above* the 10 ms-per-request limit, and it stays dead — later
requests routed to it fail. Measured, `/api/catalog/courses?limit=1000&period=all`
costs roughly 350-500 ms of CPU, so it destroys a fresh isolate after five or six
requests. Since the frontend issues that request on first load, a handful of
arriving users is enough to take isolates down. See `docs/load-test-2026-08.md`.

Almost all of that cost is rebuilding the same answer: the D1 round-trips plus
`course_catalog._build_catalog_summary`, which runs per course. The catalog is a
snapshot that only changes when someone re-imports it, so the work is identical
every time.

Caching the *encoded* bytes (not the payload object, and not a `str`) skips both
the rebuild and the UTF-8 conversion at the Python/JS boundary. Measured on an
equivalent 1.43 MB payload: rebuilding each time exhausted an isolate, while
serving pre-encoded bytes survived 150 consecutive requests untouched.

Staleness
---------
Entries live as long as the isolate does, which is minutes to hours, and isolates
are replaced continuously. The endpoint already advertises
`cache-control: public, max-age=300`, so callers are told to expect data up to
five minutes old; this does not promise anything stronger. After a catalog
re-import, responses can lag until isolates recycle — deploy the Worker to force
it.
"""

from __future__ import annotations

# Bounded so a hostile or buggy caller cannot grow this without limit. The real
# key space is small: a handful of period/limit combinations, and searches are
# not cached at all.
_MAX_ENTRIES = 8

_entries: dict[str, bytes] = {}


def build_key(limit: int, period_id: str | None) -> str:
    return f"{limit}|{period_id or ''}"


def get(key: str) -> bytes | None:
    return _entries.get(key)


def put(key: str, body: bytes) -> None:
    """Store one encoded response, evicting the oldest entry when full.

    Insertion order is dict order in CPython, so the first key is the oldest.
    """
    if key not in _entries and len(_entries) >= _MAX_ENTRIES:
        oldest = next(iter(_entries))
        del _entries[oldest]
    _entries[key] = body


def clear() -> None:
    _entries.clear()


def size() -> int:
    return len(_entries)
