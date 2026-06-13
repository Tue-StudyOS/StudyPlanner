# AI Integrations Plan: ChatGPT Actions, Hosted MCP, and StudyPlanner Tools

This document describes how StudyPlanner can expose the course catalog and personal planning features as native AI tools for ChatGPT first and Claude/MCP second. It is intentionally implementation-oriented so a future coding agent can build the feature incrementally.

## Decisions for the first implementation

- **Primary target:** ChatGPT first, through OpenAPI-backed Actions.
- **Second target:** Claude through MCP, as a hosted Cloudflare-compatible remote MCP adapter.
- **Hosting:** Cloudflare-hostable from the start.
- **Current implemented scope:** public, unauthenticated, read-only course catalog search and course detail only.
- **User model for later private tools:** AI tools act on behalf of an existing StudyPlanner user. Do not create a separate internal "AI user" for personal actions.
- **Catalog access:** Public read-only catalog tools may stay unauthenticated.
- **Personal access:** Semester plans, progress, favorites, transcript-derived data, and all writes require an explicit user grant.
- **Write access:** Tools may eventually change all user-owned planning data, but write endpoints should still support dry-run and explicit confirmation semantics to avoid accidental destructive calls.
- **Shared implementation:** ChatGPT and Claude use the same public AI facade now. Future private tools should keep that protocol-neutral split.

## Why ChatGPT Actions and MCP are similar but not identical

The domain capabilities are the same:

- search courses
- get course details
- read the user profile/progress
- read and update semester plans
- balance regulation-area assignments
- explain schedule conflicts and planning trade-offs

The protocol wrapper differs:

| Target | External protocol | Best first implementation |
| --- | --- | --- |
| ChatGPT | OpenAPI Actions over HTTPS | Serve `/api/ai/openapi.json` plus HTTPS action endpoints |
| Claude / agents | MCP tools/resources/prompts | Hosted MCP adapter that calls the same AI endpoints |
| In-app assistant | Internal tool calls | Reuse the same capability functions directly |

The important architecture rule is: **build one StudyPlanner AI capability layer, then expose it through OpenAPI and MCP adapters.**

## Current codebase leverage

Existing backend endpoints already provide most raw functionality:

- `GET /api/catalog/periods`
- `GET /api/catalog/courses?limit=100&period=<periodId|all>&q=<query>`
- `GET /api/catalog/courses/<id>`
- `GET /api/study-programs`
- `GET /api/regulation-versions`
- `GET /api/regulation-versions/<code>`
- `GET /api/me/profile`
- `GET /api/me/progress`
- `GET /api/me/semester-plans`
- `GET/PUT/DELETE /api/me/semester-plans/<semester_label>`
- `POST /api/me/semester-plans/<semester_label>/balance`

Relevant backend files:

- `backend/src/router.py` routes HTTP requests.
- `backend/src/services/course_catalog.py` builds frontend-ready catalog summaries and details.
- `backend/src/services/user_semester_plans.py` persists per-user plans in `user_state.semester_plans_json`.
- `backend/src/services/planner_assignments.py` validates and balances planner regulation-area assignments.
- `backend/src/services/progress.py` builds progress snapshots.
- `backend/src/services/authentication.py` verifies existing app bearer tokens.

Relevant frontend logic that should move server-side for AI use:

- catalog time filtering: `frontend/src/features/courses/utils/courseTimeFilters.ts`
- course type filtering: `frontend/src/features/courses/utils/courseTypeFilter.ts`
- study-area filtering: `frontend/src/features/courses/utils/studyAreaFilter.ts`
- planner conflict parsing: `frontend/src/features/planner/utils/plannerFeedback.ts`
- ICS export logic if calendar generation becomes a tool: `frontend/src/features/planner/utils/icsExport.ts`

## Recommended target architecture

```text
ChatGPT Custom GPT / Actions
        |
        | HTTPS + OpenAPI operationIds
        v
StudyPlanner AI Facade
        |
        | shared capability functions
        v
Existing StudyPlanner Worker API / services
        |
        v
Cloudflare D1

Claude / MCP-capable client
        |
        | MCP tools/resources/prompts
        v
Hosted MCP Adapter
        |
        | calls same AI Facade endpoints or shared capability functions
        v
Existing StudyPlanner Worker API / services
```

### Component roles

| Component | Responsibility |
| --- | --- |
| Core StudyPlanner API | Existing product API and D1 access. Remains source of truth. |
| AI Facade | AI-friendly, compact, permission-checked endpoints and schemas. |
| OpenAPI adapter | Exposes the AI Facade to ChatGPT Actions. |
| MCP adapter | Exposes the same capabilities as MCP tools/resources/prompts. |
| Integration grants | Per-user scoped authorization for personal data and writes. |

### Same Worker vs separate Worker

For GPT-first, the smallest path is to add AI Facade routes to the existing Python Worker:

- `/api/ai/openapi.json`
- `/api/ai/catalog/search`
- `/api/ai/me/...`
- `/api/ai/planner/...`

For hosted MCP, the repository now contains a separate TypeScript Cloudflare Worker under `integrations/studyplanner-mcp/`. It calls the AI Facade over HTTPS and does not connect directly to D1.

Recommended split:

1. **Phase 1:** implement GPT/OpenAPI routes in the existing backend Worker. ✅ public catalog facade exists, now incl. server-side search filters and a `resolve-course` endpoint.
2. **Phase 2:** implement a hosted MCP adapter under `integrations/studyplanner-mcp/` that calls the AI Facade. ✅ public catalog adapter exists (search incl. filters, resolve-course, detail).
3. **Phase 3:** if the MCP adapter needs lower latency or richer behavior, extract shared protocol-neutral capability logic into a dedicated integration Worker.

## Authentication and authorization

### Public catalog tools

Public catalog tools can be unauthenticated:

- list periods
- search courses
- get course detail
- list public study programs
- get public regulation metadata

These should never expose personal user state.

### Personal tools

Personal tools need user-specific authorization:

- read profile
- read progress
- read semester plans
- draft based on existing progress
- write plans
- change favorites
- import or edit transcript/completed-course data

The AI tool should act as the existing StudyPlanner user. Do not create a separate internal user like `chatgpt-bot@example.com` for personal actions. A separate **integration client** record is fine, but the data owner remains the real user.

### Recommended auth path

#### MVP for private/personal use: scoped integration tokens

Add user-managed integration tokens in the account area. A token is copied into a private Custom GPT Action auth field or MCP configuration.

Token properties:

- generated once, shown once
- stored hashed in D1
- tied to `user_auth.username`
- scoped
- optionally expires
- revocable
- records last-used timestamp

Example scopes:

| Scope | Allows |
| --- | --- |
| `catalog:read` | public catalog and regulation reads |
| `profile:read` | current user profile |
| `progress:read` | progress and completed-course summaries |
| `plans:read` | semester-plan reads |
| `plans:write` | semester-plan writes, add/remove courses, assignments |
| `favorites:read` | favorite-course reads |
| `favorites:write` | favorite-course changes |
| `transcript:read` | transcript issue/completed-course reads |
| `transcript:write` | completed-course/transcript issue writes |

Use a new auth helper for integration tokens rather than reusing browser login tokens directly. Browser tokens are optimized for first-party app sessions; integration tokens are optimized for third-party tool access and revocation.

#### Production/shared GPT: OAuth

If the goal is a shared public GPT that many students can use, implement OAuth Authorization Code with PKCE.

Flow:

1. ChatGPT starts OAuth authorization.
2. User signs into StudyPlanner.
3. User grants requested scopes.
4. StudyPlanner issues short-lived access token and optional refresh token.
5. ChatGPT calls AI endpoints with `Authorization: Bearer <access_token>`.

This is more work but better for multi-user sharing. Scoped integration tokens are enough for a private MVP.

### Suggested D1 schema for integration tokens

```sql
CREATE TABLE IF NOT EXISTS user_integration_tokens (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    label TEXT NOT NULL,
    token_prefix TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes_json TEXT NOT NULL DEFAULT '[]',
    expires_at_unix INTEGER,
    last_used_at_unix INTEGER,
    revoked_at_unix INTEGER,
    created_at_unix INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (username) REFERENCES user_auth(username) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_integration_tokens_username
    ON user_integration_tokens(username);

CREATE INDEX IF NOT EXISTS idx_user_integration_tokens_prefix
    ON user_integration_tokens(token_prefix);
```

If OAuth is added later, add `integration_clients`, `oauth_authorization_codes`, and refresh-token storage. Keep access tokens scoped and short-lived.

## AI Facade endpoint design

AI endpoints should return compact, stable, citation-friendly payloads. Prefer IDs plus human labels and links. Avoid dumping large raw JSON fields.

### Public endpoints

#### `GET /api/ai/meta`

Returns integration metadata, supported scopes, API version, and links.

#### `GET /api/ai/openapi.json`

OpenAPI schema consumed by ChatGPT Actions.

#### `GET /api/ai/catalog/periods`

Wrapper around `list_catalog_periods`.

#### `POST /api/ai/catalog/search`

AI-friendly structured search. Prefer POST so filters do not become unwieldy query strings.

Input:

```json
{
  "query": "machine learning",
  "semesterLabel": "SS 2026",
  "periodId": null,
  "limit": 10,
  "ects": { "min": 3, "max": 9, "exact": null },
  "weekdays": ["Monday", "Wednesday"],
  "timeWindow": { "start": "10:00", "end": "16:00" },
  "courseTypes": ["lecture", "seminar"],
  "studyAreaCodes": ["INFO-TECH"],
  "termTypes": ["summer"],
  "includeSchedule": true
}
```

Output should include a concise list:

```json
{
  "courses": [
    {
      "courseId": "978",
      "courseNumber": "INFM1234",
      "title": "Example Course",
      "periodLabel": "Sommer 2026",
      "ects": 6,
      "studyAreaCodes": ["INFO-INFO", "INFO-THEO"],
      "schedule": [
        { "day": "Monday", "time": "10:00 - 12:00", "room": "TBA", "type": "Lecture" }
      ],
      "detailUrl": "https://..."
    }
  ],
  "count": 1,
  "truncated": false
}
```

#### `GET /api/ai/catalog/courses/{courseId}`

Returns compact detail with description, prerequisites, exams, regulation options, schedule, links, and citations.

#### `POST /api/ai/catalog/resolve-course`

Resolves a stable reference such as course number + semester label into the current D1 course id.

Input:

```json
{
  "courseNumber": "INFM1234",
  "semesterLabel": "SS 2026",
  "titleHint": "Example Course"
}
```

This is important because numeric D1 course IDs are period/import specific. AI tools should prefer stable references in user-facing text but send concrete IDs for writes.

### Personal read endpoints

#### `GET /api/ai/me/profile`

Requires `profile:read`.

#### `GET /api/ai/me/progress`

Requires `progress:read`.

Return compact progress data, not every raw internal field.

#### `GET /api/ai/me/semester-plans`

Requires `plans:read`.

#### `GET /api/ai/me/semester-plans/{semesterLabel}/expanded`

Requires `plans:read`.

This is a key missing endpoint. Existing semester plans only store course IDs, assignments, and hidden slots. AI tools need expanded course details in one response.

Output:

```json
{
  "semesterPlan": {
    "semesterLabel": "SS 2026",
    "courseIds": ["978", "1006"],
    "courseAssignments": { "978": "INFO-THEO" },
    "hiddenSlotIds": [],
    "courses": [
      {
        "courseId": "978",
        "courseNumber": "INFM1234",
        "title": "Example Course",
        "ects": 6,
        "schedule": [],
        "assignedAreaCode": "INFO-THEO",
        "compatibleAreaCodes": ["INFO-THEO", "INFO-INFO"]
      }
    ],
    "conflicts": [],
    "regulationSummary": []
  }
}
```

### Planning endpoints

#### `POST /api/ai/planner/check-conflicts`

Requires `plans:read` when using personal plan data. Can be public if caller provides all course IDs and no user data is loaded.

Input:

```json
{
  "semesterLabel": "SS 2026",
  "courseIds": ["978", "1006"],
  "hiddenSlotIds": []
}
```

Output:

```json
{
  "conflicts": [
    {
      "day": "Monday",
      "start": "10:00",
      "end": "12:00",
      "courseIds": ["978", "1006"],
      "message": "Two planned courses overlap on Monday 10:00-12:00."
    }
  ]
}
```

#### `POST /api/ai/planner/draft`

Requires `plans:read`, `progress:read`, and usually `catalog:read`. Does not save.

Purpose: create a proposed semester plan from constraints.

Input:

```json
{
  "semesterLabel": "SS 2026",
  "goalEcts": 30,
  "preferredStudyAreaCodes": ["INFO-TECH", "INFO-INFO"],
  "blockedTimes": [
    { "day": "Friday", "start": "12:00", "end": "18:00" }
  ],
  "mustIncludeCourseIds": ["978"],
  "avoidCourseIds": [],
  "maxResults": 3
}
```

Output: candidate plans with conflicts, ECTS totals, regulation-area balance, warnings, and course citations. This endpoint should not mutate user data.

#### `POST /api/ai/me/semester-plans/{semesterLabel}/balance`

Wrapper around the existing balance service. Requires `plans:read` and `progress:read`; if the endpoint applies assignments, it also requires `plans:write`.

Recommended behavior:

- `dryRun: true` by default
- returns assignments and warnings
- does not save unless `apply: true` and caller has `plans:write`

### Personal write endpoints

Write endpoints should be explicit and narrow even if the tool is allowed to change all planning data.

#### `PATCH /api/ai/me/semester-plans/{semesterLabel}`

Requires `plans:write`.

Supports add/remove/set operations and a full replace mode.

Input:

```json
{
  "dryRun": true,
  "confirmApply": false,
  "operations": [
    { "type": "addCourse", "courseId": "978" },
    { "type": "setAssignment", "courseId": "978", "studyAreaCode": "INFO-THEO" },
    { "type": "removeCourse", "courseId": "1006" }
  ]
}
```

Rules:

- If `dryRun` is true, return the resulting plan preview but do not save.
- If `dryRun` is false, require `confirmApply: true`.
- Validate course IDs and assignment compatibility server-side using existing planner assignment validation.
- Return before/after summaries and warnings.

This is safer than exposing only a blind `PUT` endpoint to LLMs.

## Protocol-neutral tool catalog

These capabilities should exist independently of ChatGPT or MCP naming.

| Tool/capability | Auth | Scope | Backing service/status |
| --- | --- | --- | --- |
| `list_catalog_periods` | optional | `catalog:read` | existing `list_catalog_periods` |
| `search_courses` | optional | `catalog:read` | ✅ implemented with server-side filters (ects, weekday, time window, course type, study-area, term) |
| `get_course_detail` | optional | `catalog:read` | existing `get_catalog_course_detail` |
| `resolve_course_reference` | optional | `catalog:read` | ✅ implemented (`POST /api/ai/catalog/resolve-course`) |
| `list_study_programs` | optional | `catalog:read` | existing `_list_study_programs` |
| `get_regulation_version` | optional | `catalog:read` | existing `get_regulation_version` |
| `get_my_profile` | required | `profile:read` | existing profile service |
| `get_my_progress` | required | `progress:read` | existing progress service |
| `list_my_semester_plans` | required | `plans:read` | existing semester-plan service |
| `get_my_semester_plan_expanded` | required | `plans:read` | new AI facade helper |
| `check_schedule_conflicts` | optional/required | `plans:read` if personal | new server-side conflict helper |
| `balance_semester_plan` | required | `plans:read`, `progress:read` | existing balance service |
| `draft_semester_plan` | required | `plans:read`, `progress:read` | new composition helper |
| `update_semester_plan` | required | `plans:write` | new patch wrapper around save service |
| `set_favorites` | required | `favorites:write` | existing favorites service |

## ChatGPT OpenAPI Action design

### Operation naming

Use stable, explicit `operationId`s. ChatGPT treats these like tool names.

Good examples:

- `searchCourses`
- `getCourseDetail`
- `getMyExpandedSemesterPlan`
- `draftSemesterPlan`
- `applySemesterPlanPatch`

Avoid vague names like `update`, `query`, or `data`.

### Authentication options

MVP private GPT:

- Authentication type: API key
- Location: HTTP header
- Header name: `Authorization`
- Value: `Bearer <integration_token>`

Shared GPT later:

- Authentication type: OAuth
- Authorization URL: StudyPlanner OAuth authorize route
- Token URL: StudyPlanner OAuth token route
- Scopes: from the table above

### Write-operation guardrails

OpenAPI descriptions can tell the model to ask for confirmation, but descriptions are not a security boundary. The backend must enforce:

- `dryRun` default
- `confirmApply: true` for mutations
- scope checks
- server-side validation
- small request body limits
- clear response summaries

### Minimal first OpenAPI surface

Start small to make the GPT reliable:

1. `searchCourses`
2. `getCourseDetail`
3. `getMyExpandedSemesterPlan`
4. `draftSemesterPlan`
5. `applySemesterPlanPatch`

Add progress and transcript tools after the planning flow is stable.

## MCP design for Claude and agents

MCP can expose the same capabilities as tools. A hosted MCP adapter should be thin and call the AI Facade.

Suggested MCP tools:

- `studyplanner_search_courses`
- `studyplanner_get_course_detail`
- `studyplanner_get_profile`
- `studyplanner_get_progress`
- `studyplanner_get_semester_plan`
- `studyplanner_draft_semester_plan`
- `studyplanner_update_semester_plan`

Suggested MCP resources:

- `studyplanner://catalog/periods`
- `studyplanner://courses/{courseId}`
- `studyplanner://me/plans/{semesterLabel}`

Suggested MCP prompts:

- `plan_next_semester`
- `explain_regulation_progress`
- `find_courses_without_conflicts`

### Cloudflare-hosted MCP note

Hosted remote MCP is possible in principle, but client support differs between Claude Desktop, Claude.ai, Claude Code, Cursor, and other agents. Some clients still prefer local stdio MCP servers. To keep options open:

1. Implement a hosted HTTP/MCP adapter for Cloudflare.
2. Keep a local stdio wrapper possible by making both wrappers call the same AI Facade.
3. Do not put business logic only in the MCP adapter.

A TypeScript Worker under `integrations/studyplanner-mcp/` is likely the easiest hosted MCP implementation path because the MCP SDK ecosystem is TypeScript-first.

## Data and planning behavior

### Stable course references

Numeric course IDs are concrete D1 row IDs and can change after catalog rebuilds. AI-facing responses should always include:

- `courseId` for current API writes
- `courseNumber` when available
- `title`
- `periodId`
- `periodLabel`
- `detailUrl` or `detailPageUrl`

For user-facing explanations, prefer course number and title. For writes, send `courseId` resolved for the selected semester.

### Plan expansion

AI tools should not have to call course detail once per stored course. Add a plan-expansion helper that:

1. loads the stored semester plan
2. loads all referenced courses for the matching period
3. includes compact schedule and ECTS data
4. includes compatible regulation areas
5. computes conflicts
6. includes balance warnings

### Server-side filters

The current frontend performs several filters client-side. AI tools need the backend to support them to avoid returning large result sets.

Add backend filters for:

- ECTS range/exact
- weekday
- time window
- course type
- term type
- study-area code
- only courses without conflicts against a provided course set
- optional only courses compatible with the user's active regulation

### Conflict detection

Move or mirror the relevant logic from `frontend/src/features/planner/utils/plannerFeedback.ts` to backend Python:

- normalize weekday aliases
- parse German date labels
- ignore single-date slots for weekly conflict checks
- parse time ranges
- report overlaps deterministically

### Drafting plans

Initial drafting can be heuristic rather than a full optimizer:

1. include required `mustIncludeCourseIds`
2. filter candidate courses by semester, time, ECTS, regulation area, and course type
3. remove completed courses when possible
4. avoid conflicts
5. call the existing backend balancer for regulation assignments
6. score candidates by target ECTS, conflict count, progress gaps, and user preferences

Return multiple candidate plans rather than one opaque answer.

## Security and privacy guardrails

- Never accept StudyPlanner passwords through AI tools.
- Never ask users to paste browser session tokens into ChatGPT or Claude.
- Use scoped integration tokens or OAuth grants.
- Store integration tokens hashed, not in plain text.
- Treat course descriptions and user notes as untrusted text. Do not let them become tool instructions.
- Keep output compact. Do not dump full raw catalog payloads.
- Add rate limits for AI endpoints.
- Log tool usage metadata, not full sensitive prompts or full personal records.
- Make token revocation available in the Account UI.
- For write tools, return a preview first and require `confirmApply: true` before saving.
- Keep transcript/completed-course write tools out of the first release unless explicitly needed.

## Cloudflare implementation notes

### Existing backend Worker

The current backend is a Python Cloudflare Worker with D1 binding `DB`. Adding AI Facade routes there is the smallest GPT-first path.

Likely new files:

```text
backend/src/services/ai_catalog.py
backend/src/services/ai_planner.py
backend/src/services/integration_tokens.py
backend/src/openapi.py
backend/migrations/0023_user_integration_tokens.sql
```

Likely router additions:

```text
GET  /api/ai/meta
GET  /api/ai/openapi.json
POST /api/ai/catalog/search
GET  /api/ai/catalog/courses/<id>
GET  /api/ai/me/profile
GET  /api/ai/me/progress
GET  /api/ai/me/semester-plans
GET  /api/ai/me/semester-plans/<semester_label>/expanded
POST /api/ai/planner/check-conflicts
POST /api/ai/planner/draft
PATCH /api/ai/me/semester-plans/<semester_label>
```

### Separate MCP Worker

Possible later path:

```text
integrations/studyplanner-mcp/
  package.json
  src/index.ts
  src/tools.ts
  src/studyplannerClient.ts
  wrangler.toml
```

The MCP Worker should not have D1 access in the first version. It should call the deployed AI Facade and forward the user's integration token.

## Implementation phases

### Phase 0: OpenAPI and contracts only

- Add this planning document.
- Draft `docs/openapi.studyplanner-ai.yaml` or generate `/api/ai/openapi.json` later.
- Decide whether the first GPT is private-token based or OAuth-based.

### Phase 1: GPT public catalog actions

Goal: ChatGPT can search and explain catalog courses without personal data.

Tasks:

1. Add AI catalog service with compact serializers.
2. Add `POST /api/ai/catalog/search`.
3. Add `GET /api/ai/catalog/courses/<id>`.
4. Add `GET /api/ai/openapi.json` with only public endpoints.
5. Test with curl and then a private Custom GPT.

No new auth is required for this phase.

### Phase 2: scoped integration tokens

Goal: ChatGPT can act as the current StudyPlanner user.

Tasks:

1. Add `user_integration_tokens` migration.
2. Add token generation, hashing, verification, revocation.
3. Add scope-check helper.
4. Add Account UI for token creation/revocation or a temporary backend-only admin script for MVP.
5. Add tests for valid, expired, revoked, and insufficient-scope tokens.

### Phase 3: personal read actions

Goal: ChatGPT can inspect the user's planning context.

Tasks:

1. Add `GET /api/ai/me/profile`.
2. Add `GET /api/ai/me/progress`.
3. Add `GET /api/ai/me/semester-plans`.
4. Add `GET /api/ai/me/semester-plans/<semester_label>/expanded`.
5. Update OpenAPI with auth and scopes.

### Phase 4: dry-run planning and write actions

Goal: ChatGPT can propose and apply semester-plan changes.

Tasks:

1. Add backend conflict-check helper.
2. Add `POST /api/ai/planner/check-conflicts`.
3. Add `POST /api/ai/planner/draft`.
4. Add `PATCH /api/ai/me/semester-plans/<semester_label>` with `dryRun` and `confirmApply`.
5. Reuse existing save validation from `user_semester_plans.py` and `planner_assignments.py`.
6. Require `plans:write` for real writes.

### Phase 5: ChatGPT setup documentation

Goal: reproducible Custom GPT setup.

Tasks:

1. Document GPT instructions.
2. Document Action auth setup.
3. Include a safe test script:
   - search courses
   - read a plan
   - dry-run adding a course
   - confirm applying it
4. Document revocation.

### Phase 6: hosted MCP adapter

Goal: Claude/MCP clients can use the same tools.

Implemented public-catalog subset:

1. `integrations/studyplanner-mcp/` exists.
2. MCP tools are thin wrappers around AI Facade endpoints.
3. Hosted Cloudflare deployment is configured through `wrangler.toml`.
4. Setup docs describe the deployed `/mcp` endpoint and `/sse` compatibility advertisement.

Still deferred for later phases:

1. Local stdio fallback if remote MCP client support is insufficient.
2. Private/user-bound tools after scoped integration tokens or OAuth exist.
3. Write tools and dry-run planning tools.

### Phase 7: OAuth for shared integrations

Goal: support a public/shared GPT or third-party clients without manual token copying.

Tasks:

1. Add OAuth client registration data.
2. Add authorize/token/revoke endpoints.
3. Add consent UI.
4. Map OAuth scopes to the same internal scope checks.
5. Rotate and revoke refresh tokens safely.

## Testing and verification

Backend checks:

- unit tests for token hashing and scope validation
- route tests for unauthenticated catalog access
- route tests for authenticated personal access
- invalid/expired/revoked token tests
- plan patch dry-run does not mutate data
- plan patch with `confirmApply: true` mutates only the target user's plan
- invalid course assignment is rejected
- conflict detection handles weekly slots and single-date exam slots correctly

Frontend checks if Account UI is added:

- token creation works on mobile and desktop
- token secret is shown once
- token revocation works
- long token labels wrap safely

Manual integration checks:

1. OpenAPI schema validates.
2. ChatGPT can import the schema.
3. Public course search works without auth.
4. MCP `/mcp` initializes and lists `studyplanner_search_courses` / `studyplanner_get_course_detail`.
5. MCP search and detail calls return public catalog JSON.
6. Authenticated plan read works with integration token once private tools are implemented.
7. Dry-run write previews changes once write tools are implemented.
8. Confirmed write changes only the intended semester plan once write tools are implemented.
9. Token revocation immediately blocks further calls once tokens are implemented.

## Open questions before implementation

These should be answered before or during Phase 2:

1. Will the first GPT be private to one developer account or shared with real users?
   - Private: scoped integration token is enough.
   - Shared: OAuth should be prioritized.
2. Should write tools require backend `confirmApply: true` even if the user says tools may write freely?
   - Recommendation: yes.
3. Should transcript/completed-course write tools be included in the first release?
   - Recommendation: no; keep first release focused on semester plans.
4. Should generated plans save automatically or return a draft first?
   - Recommendation: draft first, then explicit apply.
5. Should the AI Facade expose only high-level patch operations, or also raw `PUT` plan replacement?
   - Recommendation: high-level patch operations first.
6. Should MCP be remote-only, or should a local stdio adapter be kept for Claude Desktop compatibility?
   - Recommendation: support hosted first, but keep the implementation thin enough for local fallback.

## Suggested first coding prompt for a future agent

```text
Implement Phase 1 of docs/ai-integrations-mcp-openapi-plan.md.
Add a GPT-first AI Facade with public catalog endpoints only:
- GET /api/ai/meta
- GET /api/ai/openapi.json
- POST /api/ai/catalog/search
- GET /api/ai/catalog/courses/<id>
Reuse existing course_catalog service functions where possible.
Keep responses compact and citation-friendly.
Do not add auth or write endpoints yet.
Add backend tests for serializers/search validation if practical.
Update documentation if endpoint names differ.
```

## Suggested second coding prompt

```text
Implement Phase 2 of docs/ai-integrations-mcp-openapi-plan.md.
Add user-managed scoped integration tokens for AI tools.
Tokens must be stored hashed, scoped, revocable, and tied to user_auth.username.
Add backend verification helpers and tests for valid, expired, revoked, and insufficient-scope tokens.
Do not expose transcript write access yet.
```
