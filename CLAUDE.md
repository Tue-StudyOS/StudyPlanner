# CLAUDE.md

Claude Code project instructions.

Read and follow the shared agent instructions:

@AGENTS.md

Read the agent overview when a task needs specialized expertise:

@agents/main.md

## Claude Code rules

- Use Plan Mode for larger or risky changes.
- Prefer the smallest correct solution.
- Explain which specialized agent profile is relevant when using one.
- Do not add production dependencies without asking.
- Do not run destructive git commands unless explicitly requested.
- Keep changes small and reviewable.
- For backlog or multi-feature tasks: one shared branch, one commit per group, merge once into main. See AGENTS.md → Workflow rule 7.

## Code Review

When asked to review code, act as a senior React developer and check:
- Dead code and duplication
- TypeScript correctness and type safety
- React best practices (hooks, state, props, component responsibilities)
- Naming conventions (PascalCase for components, camelCase for functions/variables)
- Inline styles and magic numbers
- Component structure and separation of concerns
- Unnecessary prop-drilling

Deliver a prioritized list: file, issue, and why it matters.

## Test data

- Debug/throwaway accounts created while reproducing auth/onboarding issues live in the
  production D1 (`studyplanner-db`) under the username pattern
  `debug-onboarding-*@example.com` (e.g. `debug-onboarding-1781713357@example.com`).
  They are intentionally kept (not deleted) for future debugging. Ignore them in user
  counts; remove with an explicit `DELETE ... WHERE username = '<exact>'` only if asked.

## Course catalog data (ALMA scraper → D1)

The catalog is a **snapshot**. Course data flows:
`data_collection/alma/scraper.py` (scrape ALMA) → `backend/data/Alma_courses.json` →
`backend/scripts/import_alma_json_to_d1.py` (import into D1) → backend reads D1.

- **A scraper change does NOT affect live data until someone re-scrapes and re-imports.**
  Editing `scraper.py` alone changes nothing users see; the data in D1 is whatever the
  last scrape produced. After scraper fixes, a re-scrape + re-import is required.
- The ALMA course catalog is **public — no auth/login**. The scraper is a plain
  `requests.Session`. You can fetch any course page yourself.
- **Testable seam:** `parse_content_page(html)` (and `parse_detail_page`) are pure
  HTML→dict functions. To capture a real fixture, drive
  `AlmaScraper().fetch_course_details(detail_url)` /
  `_submit_detail_tab(html, url, "contentsTab")`. Fixtures + tests live in
  `data_collection/alma/tests/` (run: `cd data_collection && python -m unittest discover -s alma/tests`).
- **Contents (Inhalte):** ALMA renders each course-content field as a labelled
  `boxStandard` (Lernziele, Voraussetzung, Inhalte, ...). The scraper stores them as
  `content_sections`; `services/course_catalog._build_content_sections()` surfaces them
  in the catalog detail (de-duped against Description and Prerequisites). Courses with no
  labelled boxes fall back to one "Inhalte" blob that needs nav-chrome stripping.
- **Parallel groups & teaching role:** a course splits into parallel groups (lecture,
  a tutorial slot, exam, ...). ALMA has **no structured lecture/tutorial field** — the
  role lives in the group *title* (e.g. `Stochastik (Übung)`), so the importer derives it
  (`derive_parallel_group_role`) into `parallel_groups.group_type` (previously empty),
  falling back to the course `Veranstaltungsart`. The catalog API stamps each schedule
  slot with `groupPosition` (1-based, reseed-stable) and exposes a `parallelGroups`
  summary. The planner persists the chosen group per course in the `semester_plans_json`
  blob (`courseParallelGroups`, keyed by position) and the calendar shows only that group,
  colored by role. **Populating `group_type` in prod needs a re-import** — a scraper/importer
  change alone doesn't touch live data (see above).

## Local dev

- Run backend + frontend from a git worktree when working in parallel. Backend:
  `cd backend && npx wrangler dev --remote --port 8787` (uses the real D1; needs wrangler
  auth). Frontend: `npm run dev` (port 5173).
- At `localhost`, the frontend auto-targets `http://localhost:8787` (see
  `getApiBaseUrl`). **Do not add a `.env.local` with a misspelled `VITE_API_BASE_URL`** —
  a typo'd worker host once made the whole app silently hit a stale backend.
- `wrangler dev --remote` can exit mid-session when a periodic preview-token refresh fails
  to reach `api.cloudflare.com` (transient network issue) — not a code error; just restart.

## Design

- The app must visually match `StudyOS.html` exactly — always use its colors, typography, spacing, and component styles as the reference.
- Before implementing any UI, read `StudyOS.html` to extract the relevant styles.
- Do not invent new styles; replicate what is in `StudyOS.html`.
- Use Tailwind classes whenever its possible.