# Code Simplification Audit — July 2026

## Product surfaces

The main navigation contains three student workflows:

- `/catalog` — catalog and course details
- `/semester` and `/semester/:label` — semester overview and planner
- `/transcript` — transcript import, review, and progress

The following reachable surfaces are not obsolete merely because they are not
main navigation tabs:

- `/account` and the study-setup gate
- `/log`, browser request logging, and server client-error history
- onboarding/help and feedback overlays
- `/beta`, linked by the `Test UI` top-bar button
- `/katalog` and `/planner` compatibility redirects

The diagnostics route and all logging code are intentionally retained. The
cleanup must not remove student workflows or operational access to logs.

## Removed code

A TypeScript import-graph walk starts at `frontend/src/main.tsx` and includes
static, re-exported, and dynamic imports. Before cleanup it found six production
orphans and two utilities referenced only by tests for removed UI:

- unused catalog legend and archived glyph experiment
- unused planner barrel export
- unused category badge and regulation-area modal/data
- old numbered course-badge and balanced-strip helpers plus their isolated tests

After removal all 194 files under `frontend/src` are reachable from the
production entry point. TypeScript `noUnusedLocals` and `noUnusedParameters`
remain enabled, so unused imports fail the build.

A duplicated `_normalize_stored_plan_course_ids` definition in
`user_semester_plans.py` was also removed. The second definition previously
silently replaced the first at module import time.

## Abstractions

Only one new general abstraction was justified: `getErrorMessage` replaces the
same error-to-message block in four synchronization modules. Larger-looking
similarities were left alone:

- Catalog and planner course-detail sheets have different headers, actions,
  dimensions, and state. Generalizing their shared markup would add options
  rather than simplify the code.
- Account setup and the mandatory study-setup gate fetch the same option list,
  but their lifecycle and validation behavior differ enough that a hook would
  save little code.
- Backend id normalizers have different trust boundaries and error behavior.

The remaining try/catch blocks primarily surround actual boundaries: network
requests, browser storage, JSON/PDF parsing, authentication, and D1 calls. They
were not removed merely to reduce a count. Request logging was explicitly kept.

## Security findings

Implemented without removing existing user functionality:

- Registration and credential updates show a soft strong/weak password hint in the
  UI, but passwords are only required to be non-empty on the server.
- Static Pages responses send `nosniff`, clickjacking, referrer, and browser
  permissions headers.
- Frontend production dependencies currently have zero known npm audit findings.
- No tracked secrets, unsafe deserialization, runtime `eval`, or React
  `dangerouslySetInnerHTML` use was found in the student web app.

Follow-up implementation:

- `GET /api/client-errors` now requires authentication. Students receive only
  their own reports; aggregated entries are limited to the usernames configured
  through `DIAGNOSTICS_ADMIN_USERNAMES`.
- Signed session tokens moved from local storage to HttpOnly cookies. The
  frontend receives only a session-bound CSRF proof for authenticated mutations.
- D1-backed limits cover login, registration, feedback, AI catalog mutations,
  and client-error reporting. They retain only a hashed client identifier.
- Browser-session logs remain local to the current tab, while Cloudflare Worker
  logs remain available to operators.

## Performance findings

The all-period catalog response is about 1.50 MB uncompressed and returns 369
logical courses. The previous backend split related records into 80-id chunks,
causing roughly 30 related D1 requests on the hot path.

The optimized path passes trusted integer ids through SQLite `json_each(?)` and
loads each relation once. Remote preview validation returned the same response
size, course count, and merged course data. Public catalog GETs are additionally
cached by the Pages gateway; authenticated and non-catalog requests are never
cached there.

The catalog also previously mounted two independent `useProgressSnapshot`
hooks. The already-loaded snapshot is now passed to the progress hint, avoiding
a duplicate progress request on a cold catalog render.

Route-level lazy loading remains active. The 468 kB PDF parser and 1.29 MB PDF
worker are transcript-only assets and do not enter the initial app chunk.

## Deliberately retained size

- `features/newui` (about 1,437 lines) powers the visible `/beta` Test UI.
- `StudyOS.html` (about 82 kB) is still the documented visual reference.
- `backend/data/alma.sqlite` (about 60.3 MB) is still used by collection,
  matching, and curriculum tooling.
- `pdfjs-dist` is required for transcript PDF import and is lazy-loaded.
- The four frontend production packages are all used.

Removing any of these requires an explicit product or data-pipeline decision;
they are not dead production imports.

## Open product questions

1. Is `/beta` still an active test surface? If not, removing it saves about
   1,437 source lines and one lazy chunk without touching the three main tabs.
2. Must `StudyOS.html` remain executable source, or may its stable design tokens
   be moved to a smaller design-system document?
3. Who exactly may open server-wide diagnostics: a username allow-list, a new
   administrator role, or Cloudflare operators only?
4. Must the catalog show every historical course immediately, including time
   filters, or may historical details load on demand? This determines whether
   the initial 1.50 MB payload can be reduced substantially.
5. Which production performance target matters most: first catalog load,
   planner interaction, transcript parsing, or low-end mobile rendering?
6. Which browsers and oldest mobile devices are supported? This affects how far
   compatibility fallbacks can safely be removed.
7. Is anonymous feedback required, and should account registration remain open
   to everyone? The answer determines appropriate abuse controls.
8. Can the legacy SQLite matching/curriculum source be replaced by a
   reproducible seed or remote export so the 60.3 MB file can leave Git?
