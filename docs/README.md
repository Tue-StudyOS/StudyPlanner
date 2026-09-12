# Documentation

Start with [local development](cloudflare-development.md) for the one-time setup
and the two daily startup commands.

## Setup and operations

- [Deploy to Cloudflare](cloudflare-setup.md): manual deployment, branch previews and Git integration.
- [Runtime configuration](cloudflare-runtime-config.md): active resources, routing, secrets and catalog refresh.
- [Frontend](../frontend/README.md) and [source structure](../frontend/src/README.md).
- [Backend](../backend/README.md): routes, data ownership and import tooling.
- [Data collection](../data_collection/README.md): ALMA and learning-platform ingestion.
- [AI integrations](ai-integrations-setup.md) and [MCP adapter](../integrations/studyplanner-mcp/README.md).
- [Mobile testing](mobile-testing.md) and [load-test harness](../load-test/README.md).

## Feature contracts and privacy

- [Authentication and request security](authentication.md).
- [Semester planner](semester-planner.md).
- [Examination regulations](regulation-model.md).
- [Catalog API fields](catalog-api-field-audit.md).
- [Progress visualization categories](progress-visualization-categories.md).
- [Transcript import scope](transcript-import-scope.md).
- [Privacy notes](privacy/privacy-notes.md), [September audit](privacy/privacy-audit-2026-09.md)
  and [operator input](privacy/implementation-input.md).

## Plans and historical evidence

These are design proposals or records of earlier work, not current deployment
instructions or proof of today's live state:

- [Frontend overhaul specification](frontend-overhaul-spec.md).
- [AI integration design proposal](ai-integrations-mcp-openapi-plan.md).
- [Cloudflare open-testing audit](cloudflare-open-testing-audit.md).
- [July repository overhaul](repository-overhaul-2026-07.md).
- [July simplification audit](code-simplification-audit-2026-07.md).
- [August load-test investigation](load-test-2026-08.md), retained because the Worker config depends on its findings.
- [Implementation backlog](../IMPLEMENTATION_BACKLOG.md) and [TODO](../TODO.md).

Obsolete initial-migration instructions, duplicate mock-data status and superseded
planner implementation reports have been removed. Git history preserves them.
Current setup and planner behavior are documented in the guides above.
