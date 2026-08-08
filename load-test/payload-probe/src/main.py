"""Parameterised payload probe: separates response size from per-request allocation.

    /?kb=900&mode=build    build the rows and serialise them on every request
    /?kb=900&mode=cached   build once per isolate, then return the cached string

Both modes return a body of the same size, so comparing them isolates the two
variables that probe 3 changed together:

  - if `build` fails and `cached` is clean, the cost is per-request allocation
    and caching the serialised body is a sufficient fix, with no API change;
  - if both fail at the same size, the response size itself is the problem and
    the catalog has to be paginated.

Varying `kb` at fixed concurrency gives the dose-response curve, and therefore
the size at which it becomes unsafe.
"""

import json
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

# Populated on first use, per isolate. The point of `cached` mode.
_cached_bodies: dict[int, str] = {}


def _build_body(kilobytes: int) -> str:
    row_count = max(1, (kilobytes * 1024) // _BYTES_PER_ROW)
    courses = [dict(_ROW_TEMPLATE, id=index) for index in range(row_count)]
    return json.dumps({"courses": courses})


def _read_int_param(url: str, name: str, default: int) -> int:
    marker = f"{name}="
    position = url.find(marker)
    if position == -1:
        return default
    raw = url[position + len(marker):].split("&")[0]
    return int(raw) if raw.isdigit() else default


class Default(WorkerEntrypoint):
    async def on_fetch(self, request: Any) -> Any:
        url = str(request.url)
        kilobytes = _read_int_param(url, "kb", 900)
        mode = "cached" if "mode=cached" in url else "build"
        return await self._respond(kilobytes, mode)

    async def _respond(self, kilobytes: int, mode: str) -> Any:
        if mode == "cached":
            body = _cached_bodies.get(kilobytes)
            if body is None:
                body = _build_body(kilobytes)
                _cached_bodies[kilobytes] = body
        else:
            body = _build_body(kilobytes)

        return Response(
            body,
            headers={
                "content-type": "application/json",
                "x-probe-mode": mode,
                "x-probe-kb": str(kilobytes),
                "x-probe-rows": str(max(1, (kilobytes * 1024) // _BYTES_PER_ROW)),
                "x-probe-bytes": str(len(body)),
            },
        )
