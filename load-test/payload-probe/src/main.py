"""Parameterised probe for the Pyodide isolate hang.

Routes
------
``/?kb=900&mode=build``    build the rows and serialise them on every request
``/?kb=900&mode=cached``   build once per isolate, then return the cached string
``/?kb=1&ballast_mb=32``   set this isolate's resident ballast to exactly 32 MB
``/heap``                  memory diagnostics for the serving isolate, as JSON

Why ballast exists
------------------
Two hypotheses survive the measurements in ``docs/load-test-2026-08.md``:

1. the fault is driven by *response bytes in flight*, or
2. the fault is driven by *total memory resident in the isolate*, of which the
   in-flight bodies are only one contributor.

They predict differently. Ballast is memory that is allocated and held but never
sent, so under (1) it is invisible and the hang threshold does not move, while
under (2) every megabyte of ballast should cost a megabyte of headroom.

``ballast_mb`` is absolute rather than cumulative, so any isolate can be dialled
to a given level on demand — which matters because isolates cannot be created or
destroyed on request, only reached.

Since a keep-alive connection pins to one isolate, a client can set the ballast
and then measure on the same connection. Every response reports the ballast and
the isolate identity so that assumption is checked rather than trusted.
"""

import gc
import json
import secrets
import sys
from typing import Any

from workers import Response, WorkerEntrypoint

# Shaped like a catalog row so per-object serialisation cost is comparable to the
# real endpoint rather than one giant string.
_ROW_TEMPLATE = {
    "id": 0,
    "title": "Einführung in die Praktische Informatik (Vorlesung)",
    "lecturer": "Prof. Dr. Beispiel Mustermann",
    "ects": 9,
    "semester": "WiSe 2026/27",
    "description": "x" * 240,
}
_BYTES_PER_ROW = 400
_ONE_MEGABYTE = 1024 * 1024

# Populated on first use, per isolate. The point of `cached` mode.
_cached_bodies: dict[int, str] = {}

# Built once per isolate and kept already encoded, for mode=cachedbytes.
_cached_encoded: dict[int, bytes] = {}

# Resident, never sent. Each entry is one megabyte.
_ballast: list[bytearray] = []

# Module-level state is captured in the Pyodide start-up snapshot and restored
# into every isolate, so anything derived here would be identical everywhere.
# These are therefore filled on first request instead.
_isolate_id: str | None = None
_requests_served = 0


def get_isolate_id() -> str:
    """Stable for the life of one isolate, different across isolates."""
    global _isolate_id
    if _isolate_id is None:
        _isolate_id = secrets.token_hex(8)
    return _isolate_id


def next_sequence() -> int:
    global _requests_served
    _requests_served += 1
    return _requests_served


def set_ballast(megabytes: int) -> int:
    """Resize the resident allocation to exactly `megabytes`, and return it.

    Uses `bytearray`, which allocates real zeroed pages in the WASM heap, so the
    cost cannot be elided the way a lazily materialised object could be.
    """
    global _ballast
    megabytes = max(0, min(megabytes, 512))
    while len(_ballast) > megabytes:
        _ballast.pop()
    while len(_ballast) < megabytes:
        _ballast.append(bytearray(_ONE_MEGABYTE))
    return len(_ballast)


def memory_snapshot() -> dict[str, Any]:
    """Whatever the runtime is willing to tell us about memory use.

    `getallocatedblocks` is CPython's own count of live allocations, which is
    cheap and always available. The WASM heap size is the number that actually
    matters, so it is attempted too, but Pyodide does not guarantee that handle
    exists — hence the guard rather than an assumption.
    """
    snapshot: dict[str, Any] = {
        "allocated_blocks": sys.getallocatedblocks(),
        "gc_counts": list(gc.get_count()),
        "ballast_mb": len(_ballast),
        "cached_bodies": len(_cached_bodies),
    }
    try:
        import pyodide_js  # noqa: PLC0415 — only meaningful inside Pyodide

        snapshot["wasm_heap_bytes"] = int(pyodide_js._module.HEAPU8.length)
    except Exception as error:  # noqa: BLE001 — diagnostic path, report and continue
        snapshot["wasm_heap_bytes"] = None
        snapshot["wasm_heap_error"] = f"{type(error).__name__}: {error}"
    return snapshot


def _build_body(kilobytes: int) -> str:
    row_count = max(1, (kilobytes * 1024) // _BYTES_PER_ROW)
    courses = [dict(_ROW_TEMPLATE, id=index) for index in range(row_count)]
    return json.dumps({"courses": courses})


def _read_int_param(url: str, name: str, default: int | None) -> int | None:
    marker = f"{name}="
    position = url.find(marker)
    if position == -1:
        return default
    raw = url[position + len(marker):].split("&")[0]
    return int(raw) if raw.isdigit() else default


def _probe_headers(extra: dict[str, str]) -> dict[str, str]:
    snapshot = memory_snapshot()
    headers = {
        "x-probe-isolate": get_isolate_id(),
        "x-probe-seq": str(next_sequence()),
        "x-probe-ballast-mb": str(snapshot["ballast_mb"]),
        "x-probe-blocks": str(snapshot["allocated_blocks"]),
        "x-probe-heap": str(snapshot["wasm_heap_bytes"]),
        "access-control-expose-headers": "*",
    }
    headers.update(extra)
    return headers


class Default(WorkerEntrypoint):
    async def on_fetch(self, request: Any) -> Any:
        url = str(request.url)

        requested_ballast = _read_int_param(url, "ballast_mb", None)
        if requested_ballast is not None:
            set_ballast(requested_ballast)

        if "/heap" in url:
            return Response(
                json.dumps(
                    {"isolate": get_isolate_id(), "seq": _requests_served, **memory_snapshot()}
                ),
                headers=_probe_headers({"content-type": "application/json"}),
            )

        kilobytes = _read_int_param(url, "kb", 900) or 900

        # Builds the payload and throws it away, returning a tiny response. This
        # splits the two costs that every other mode charges together: creating
        # the objects and the JSON string inside Python, versus handing a large
        # body to the runtime to send. Whichever one kills the isolate decides
        # whether the fix is fewer fields or fewer rows per response.
        if "discard=1" in url:
            body = _build_body(kilobytes)
            built = len(body)
            del body
            return Response(
                json.dumps({"discarded_bytes": built}),
                headers=_probe_headers(
                    {"content-type": "application/json", "x-probe-mode": "discard"}
                ),
            )

        # Pure CPU with no payload at all. Establishes what a single request is
        # actually allowed to burn, which decides whether the kills seen while
        # serving large bodies are a per-request ceiling or a sustained-rate one.
        # Counted, not timed. A clock-bounded loop cannot work here: Workers
        # freeze time between I/O operations as a timing-attack mitigation, so
        # `time.monotonic()` never advances and the loop runs until the runtime
        # kills it. That accident is how the 2020 ms per-request CPU ceiling was
        # first measured, but it is useless as a dial.
        spin_kilo = _read_int_param(url, "spin_k", None)
        if spin_kilo:
            total = 0
            for index in range(spin_kilo * 1000):
                total += index * index
            return Response(
                json.dumps({"spin_k": spin_kilo, "total": total}),
                headers=_probe_headers({"content-type": "application/json", "x-probe-mode": "spin"}),
            )

        mode = "cached" if "mode=cached" in url else "build"
        if "mode=bytes" in url:
            mode = "bytes"
        if "mode=cachedbytes" in url:
            mode = "cachedbytes"
        return await self._respond(kilobytes, mode)

    async def _respond(self, kilobytes: int, mode: str) -> Any:
        # Same bytes on the wire, but handed over already encoded. If this is
        # materially cheaper than returning a `str`, the cost is the implicit
        # UTF-8 conversion at the Python/JS boundary rather than the transfer,
        # and the real backend can buy headroom by encoding its own bodies.
        if mode == "bytes":
            encoded = _build_body(kilobytes).encode("utf-8")
            return Response(
                encoded,
                headers=_probe_headers(
                    {
                        "content-type": "application/json",
                        "x-probe-mode": "bytes",
                        "x-probe-kb": str(kilobytes),
                        "x-probe-bytes": str(len(encoded)),
                    }
                ),
            )

        # Build once per isolate and keep the *encoded* bytes. This is the cheapest
        # a response can possibly be while still being sent, so it measures the
        # irreducible cost of handing a body to the runtime — the floor that any
        # caching fix in the real backend would converge to.
        if mode == "cachedbytes":
            encoded = _cached_encoded.get(kilobytes)
            if encoded is None:
                encoded = _build_body(kilobytes).encode("utf-8")
                _cached_encoded[kilobytes] = encoded
            return Response(
                encoded,
                headers=_probe_headers(
                    {
                        "content-type": "application/json",
                        "x-probe-mode": "cachedbytes",
                        "x-probe-bytes": str(len(encoded)),
                    }
                ),
            )

        if mode == "cached":
            body = _cached_bodies.get(kilobytes)
            if body is None:
                body = _build_body(kilobytes)
                _cached_bodies[kilobytes] = body
        else:
            body = _build_body(kilobytes)

        return Response(
            body,
            headers=_probe_headers(
                {
                    "content-type": "application/json",
                    "x-probe-mode": mode,
                    "x-probe-kb": str(kilobytes),
                    "x-probe-bytes": str(len(body)),
                }
            ),
        )
