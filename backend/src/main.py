from __future__ import annotations

from typing import Any

from workers import WorkerEntrypoint

from router import route_request


class Default(WorkerEntrypoint):
    """Cloudflare Worker entry point for the StudyPlanner API."""

    # Must stay `on_fetch` at the compatibility date pinned in wrangler.toml.
    # Later dates dispatch to `fetch` instead, which is one of the reasons the
    # bump was reverted — see the comment there.
    async def on_fetch(self, request: Any) -> Any:
        return await route_request(request, self.env)
