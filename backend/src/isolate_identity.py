"""Per-isolate identity, so a response can be attributed to the isolate that served it.

Cloudflare exposes no isolate identifier. Diagnosing the wedge recorded in
docs/load-test-2026-08.md needs one: 56 consecutive failures arrived on a single
TLS connection while nineteen other connections were served normally, and the
open question is whether the isolate behind that connection was itself dead or
was fine and only that connection was stuck to it. Those have different causes.

**The id must be generated lazily, not at module scope.** Module-level code runs
once and is captured in the Pyodide startup snapshot, which every isolate then
restores — so a module-scope value is *identical* across isolates and identifies
nothing. Cloudflare enforces this directly: `secrets.token_hex()` at import time
fails with

    OSError: [Errno 29] Cannot get entropy outside of request context

Generating on first use puts it inside a request context (legal) and after the
snapshot was taken (correct): the snapshot holds `None`, and each restored
isolate fills it in once.

Diagnostic only — nothing reads these headers to make a decision.
"""

from __future__ import annotations

import secrets
import time

_isolate_id: str | None = None
_first_seen_at: float | None = None
_responses_served = 0


def get_isolate_id() -> str:
    """Stable for the life of one isolate, different across isolates."""
    global _isolate_id
    if _isolate_id is None:
        _isolate_id = secrets.token_hex(8)
    return _isolate_id


def next_response_sequence() -> int:
    """Position of this response in the isolate's lifetime, starting at 1.

    Counts responses rather than requests: it is incremented where headers are
    built, so a request that hangs before that never takes a number and leaves a
    gap. The gap is itself the signal.
    """
    global _responses_served
    _responses_served += 1
    return _responses_served


def isolate_age_ms() -> int:
    """Milliseconds since this isolate served its first response.

    Measured from first use rather than from module import, for the same reason
    the id is: import time is baked into the snapshot and is the same everywhere.
    """
    global _first_seen_at
    now = time.time()
    if _first_seen_at is None:
        _first_seen_at = now
    return int((now - _first_seen_at) * 1000)
