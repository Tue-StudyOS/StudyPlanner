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

# Searches are cached too, so the key space is caller-controlled and the bound
# has to be on bytes rather than entries: one entry can be 1.5 MB and another
# 20 KB. Isolates tolerate far more than this (measured: 179 MB of resident
# allocation), so the budget is set for politeness, not survival.
_MAX_BYTES = 16 * 1024 * 1024
_MAX_ENTRIES = 64

_entries: dict[str, bytes] = {}
_total_bytes = 0


def build_key(limit: int, period_id: str | None, search: str | None = None) -> str:
    """Identify one cacheable response.

    Search terms are normalised the way the query is, so that `Info`, `info ` and
    `info` share an entry — broad prefixes are both the most expensive responses
    to build and the ones most users type, which is what makes caching them
    worthwhile.
    """
    normalized_search = (search or "").strip().lower()
    return f"{limit}|{period_id or ''}|{normalized_search}"


def get(key: str) -> bytes | None:
    return _entries.get(key)


def put(key: str, body: bytes) -> None:
    """Store one encoded response, evicting oldest-first to stay within budget.

    Insertion order is dict order in CPython, so the first key is the oldest. A
    body larger than the whole budget is simply not cached, rather than being
    stored and immediately evicting everything else.
    """
    global _total_bytes
    if len(body) > _MAX_BYTES:
        return

    existing = _entries.pop(key, None)
    if existing is not None:
        _total_bytes -= len(existing)

    _entries[key] = body
    _total_bytes += len(body)

    while _entries and (_total_bytes > _MAX_BYTES or len(_entries) > _MAX_ENTRIES):
        oldest = next(iter(_entries))
        if oldest == key:
            break
        _total_bytes -= len(_entries.pop(oldest))


def clear() -> None:
    global _total_bytes
    _entries.clear()
    _total_bytes = 0


def size() -> int:
    return len(_entries)


def total_bytes() -> int:
    return _total_bytes
