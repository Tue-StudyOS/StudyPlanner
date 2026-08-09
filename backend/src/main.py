from __future__ import annotations

import json
from typing import Any

from workers import WorkerEntrypoint

from router import route_request
from services.retention import run_retention_cleanup


class Default(WorkerEntrypoint):
    """Cloudflare Worker entry point for the StudyPlanner API."""

    # Must stay `on_fetch` at the compatibility date pinned in wrangler.toml.
    # Later dates dispatch to `fetch` instead, which is one of the reasons the
    # bump was reverted — see the comment there.
    async def on_fetch(self, request: Any) -> Any:
        return await route_request(request, self.env)

    # This compatibility date dispatches entrypoint handlers with the legacy
    # `on_` prefix, just as it does for on_fetch above. Do not rename this or
    # raise the date without the documented remote cold-start check.
    async def on_scheduled(self, controller: Any, env: Any, ctx: Any) -> None:
        del controller, ctx
        counts = await run_retention_cleanup(env)
        print(json.dumps({'event': 'retention_cleanup', **counts}, separators=(',', ':')))
