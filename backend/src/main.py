from __future__ import annotations

from typing import Any

from workers import WorkerEntrypoint

from router import route_request


class Default(WorkerEntrypoint):
    """Cloudflare Worker entry point for the StudyPlanner API."""

    async def on_fetch(self, request: Any) -> Any:
        return await route_request(request, self.env)
