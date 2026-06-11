# Frontend Overhaul Spec

Goal: turn the app from a nice demo into a daily-use tool. The Planner becomes the
primary surface, the Catalog becomes a semester-independent course directory with
offering-likelihood data, and all views get decluttered: minimal info first, details
on click, no dead text, no manual save/delete ceremony.

This is a working spec, not a backlog dump. Work through it package by package on
**one shared branch**, one commit per work package (AGENTS.md workflow rule 7).
Packages are ordered so that data/API changes land before the UI that needs them.

Legend: `[FE]` frontend-only, `[BE]` needs backend/API or DB work, `[?]` open question.

---

## WP1 — Navigation and information architecture `[FE]`

Current state: tab order is Dashboard, Catalog, Planner, Transcript
(`frontend/src/features/layout/nav.ts`); Dashboard is the root route `/`
(`frontend/src/config/routes.ts`).

Target:

1. Tab order becomes **Planner, Catalog, Overview, Transcript**.
2. Planner is the main page: route `/` renders the Planner. Keep `/planner` as a
   redirect or alias so old links keep working.
3. Dashboard is renamed to **Overview** everywhere (nav label, page heading, route
   becomes `/overview` or stays as-is internally — pick the smallest change that
   keeps deep links working).
4. "Favorites" is renamed to **"Interested"** across the entire app: star tooltip
   (`FavStar.tsx`), error messages (`FavoritesProvider.tsx`), planner panel
   (`PlannerFavoritesPanel.tsx`), onboarding copy (`onboarding/steps.ts`).
   Internal identifiers (API route `/api/me/favorites`, hook names) may stay; only
   user-facing strings must change. Renaming internals is optional follow-up polish.

Acceptance:
- Opening the app lands on the Planner.
- No user-visible string says "Favorites" or "Dashboard" anymore.

---

## WP2 — Course offering model: semester-independent catalog data `[BE]`

This is the data foundation for WP3. Today the catalog is fetched per period
(`useCatalogCourses(search, limit, periodId)`, period picker in `Overview.tsx`).

Target model — every catalog course carries:

1. **Offering history**: the list of periods (semesters) in which we have data for
   this course (e.g. `["WiSe 2025/26", "SoSe 2026"]`).
2. **Term type**: whether the course is a summer-term course, winter-term course,
   or both — derived from the offering history.
3. **Offering status** relative to the semester currently being planned:
   - `confirmed` — we have catalog data for that exact semester.
   - `likely` — no data for the target semester yet, but the course ran in the most
     recent same-season semester (e.g. planning WiSe 2026/27, course ran WiSe 2025/26).
   - `unknown` — the course did NOT run in the most recent same-season semester;
     we have no signal it will return.
   - `always` — compulsory CS modules (Pflichtmodule Informatik). These are fixed
     by the regulation and always offered; never downgrade them to likely/unknown.
     `[?]` Decide how to detect them: regulation mapping (`hasRegulationMapping` /
     `studyAreaOptions` with mandatory area type) vs. an explicit flag in the DB.
4. The catalog API gets an "all courses" mode: deduplicated courses across all
   periods (one entry per course, with offering history attached), instead of one
   period slice. Dedup key `[?]`: course number is the natural candidate, but verify
   that numbers are stable across periods in the ALMA data before relying on it.

Acceptance:
- API returns each distinct course once, with offering history, term type, and
  enough data to compute offering status client-side for any target semester.
- Compulsory modules report `always`.

---

## WP3 — Catalog overhaul `[FE]` (depends on WP2)

Current state: `frontend/src/features/courses/components/Overview.tsx` with a
semester `<select>`, always-visible ECTS/topic-area filter chips, and a card grid.

### 3.1 Remove semester selection
- Delete the semester picker entirely. The catalog always shows all courses
  (deduplicated, from WP2). Per-period browsing is gone.

### 3.2 Offering status on cards
- `likely` courses show a small, unobtrusive marker (e.g. a subtle "likely" tag
  with the season it last ran).
- `unknown` courses are rendered slightly grayed out (reduced opacity on the card)
  with a hint that there is currently no information that they will run again.
- `confirmed` and `always` courses look normal.
- A filter (inside the collapsible filter section, see 3.4) can hide `unknown`
  courses.

### 3.3 Simplified course cards (`shared/components/CourseCard.tsx`)
Visible on the card, nothing else:
- Course **title without the course number** and with the type suffix stripped from
  the end of the name (e.g. "… (Vorlesung)" / "… Übung" endings removed — write a
  shared `cleanCourseTitle()` utility, also used in WP5).
- The **type tag once** (Vorlesung / Übung / Seminar …) as a pill — never in the title.
  Lecture+exercise combos stay one card with one combined tag.
- The **master categories** (CatBadges) for crediting.
- The **professor** (cleaned name, as today).
- The Interested star.
- Removed from the card: course number, time slot, room, ECTS row footer.
  Everything else moves to the detail view.
- Summer/winter term type must be distinguishable on the card (small season tag or
  icon).

### 3.4 Search, filters, sorting
- Search stays at the top as-is.
- All other filters (ECTS, topic areas, NEW: time filters, NEW: hide-unknown,
  NEW: term type summer/winter) move into a **collapsible "Filters" section** that is
  closed by default so the top of the page stays clean. Show an active-filter count
  on the toggle button.
- New **time filters**: filter by weekday and/or time-of-day (e.g. morning /
  afternoon / evening, or "free on Friday"). `[?]` Exact granularity — start with
  weekday + before/after midday and extend later.
- New **sorting**: at least by title, ECTS, professor. Sort control sits next to the
  filter toggle, not inside it.

### 3.5 Missing-areas progress box (sticky)
- A small, subtle box above the course grid showing which regulation areas of the
  degree are still missing/underfilled ("you still need X in THEO, Y in PRAK …"),
  so the user keeps it in mind while browsing.
- It is **sticky**: it scrolls along when the user scrolls deeper into the list.
  Keep it visually small (one slim row, compact badges) so it never dominates.
- Data source: same progress data the Dashboard/Overview uses
  (`useProgressSnapshot` / regulation progress).

### 3.6 Layout toggle: scattered vs single column
- A button toggles between the **scattered** layout (multi-column card grid, current
  `md:grid-cols-2`) and a **single-column** list.
- Persist the choice (localStorage).

### 3.7 Detail-open behavior in two-column mode
- When a card is clicked in the two-column layout: the grid collapses to one column,
  the detail drawer opens, and the **clicked card keeps its visual position** — the
  remaining cards reflow around it. The user must not lose the card they clicked.
- Implementation hint: scroll-anchoring on the selected card after the layout
  switch (e.g. `scrollIntoView`/scroll offset correction in a layout effect) is
  acceptable; pixel-perfect FLIP animation is not required.

Acceptance:
- Catalog loads with no semester picker, clean cards (title, type tag, categories,
  professor, star, season), collapsible filters, sorting, sticky progress box.
- `unknown` courses are grayed out and filterable; `likely` courses are marked.
- Clicking a card in two-column mode never makes the clicked card jump away.

---

## WP4 — Course detail view overhaul `[FE]`
(`frontend/src/features/courses/components/CourseDetail.tsx` / `CourseDetailDrawer.tsx`)

1. **Show the description.** It is already in the DB and in the `Course` type
   (`description` field) but not rendered in the catalog detail view. Render it.
2. **Hide missing information.** Any field without data (room, language,
   prerequisites, frequency, SWS, …) is simply not rendered — no "TBA"/"–" rows.
   **One exception:** the Moodle/Ilias link. `[BE]` The DB field does not exist yet;
   build the UI slot now: if a link exists, show it; if not, explicitly display
   that no Moodle/Ilias link is available. This is the only "missing data" that is
   shown as missing.
3. **Type tag, clean title.** Same as cards: type only as a tag, type suffix
   stripped from the title end (shared `cleanCourseTitle()`).
4. **Weekly mini-grid for times.** Schedule slots are not listed as plain text.
   Instead render a small weekly grid (Mon–Fri columns, typical lecture hours as
   rows) where each slot is a colored block. Small but readable; room/details can
   sit next to it or appear on hover/tap.
   - If a course has **no time data**, the grid still renders, just empty — the
     schedule section never disappears.
   - **Exam dates are the exception**: they stay plain text (date, type, duration).

Acceptance:
- Detail view shows description, mini weekly grid (possibly empty), exam dates as
  text, Moodle/Ilias slot (link or explicit "not available"), and no empty fields.

---

## WP5 — Planner overhaul `[FE]` (+ small `[BE]` for auto-save if needed)
(`frontend/src/features/planner/components/SemesterPlanner.tsx`, `PlannerGrid.tsx`,
`PlannerDialogs.tsx`, `PlannerFavoritesPanel.tsx`)

### 5.1 Semester selection
- The **current semester is always selected by default** on load.
- Switching to past/other semesters happens through a very **minimal control**
  (e.g. a small inline dropdown or chevron next to the heading) — no big selector UI.
- Remove the "current semester" tag/badge; it is implied by the default.

### 5.2 Remove ceremony
- Delete the **"Delete plan" button** entirely.
- Remove the helper texts: "Plan the selected semester here and keep only the
  schedule details that matter." and "Plan the selected semester in a fixed weekly
  view." and the **"Unsaved semester draft"** state.
- **Auto-save**: every change (add/remove/move course) persists automatically.
  There is no unsaved state and no explicit save action. `[BE]` if the current API
  only supports whole-plan saves, debounce-save the whole plan on change.

### 5.3 Removing a course from the plan
- No trash icon on planned course blocks.
- Clicking a planned course opens its **detail view**; at the very bottom of that
  detail view there is a **"Remove from plan"** button.

### 5.4 Progress strip on top
- A **minimal study-progress view at the top** of the Planner: current degree
  progress plus the **delta caused by the planned courses** of this semester
  (e.g. "TECH 12/24 → 18/24"). One slim row, same progress data as Overview.
  It updates live as courses are added/removed.

### 5.5 Desktop layout: planner + Interested panel
- The weekly plan shrinks somewhat to leave room for an **"Interested" side panel**
  (the renamed favorites) on desktop.
- Interested cards in that panel show only minimal data (clean title, type tag,
  categories).
- Clicking an interested card opens the **large detail view centered on screen**
  (modal) — the same detail view as clicking a planned course (5.3), with
  "Add to plan" instead of "Remove from plan".

### 5.6 Calendar export
- The planned semester can be **exported to the user's own calendar**.
- Primary format: **ICS file download** (one VEVENT per schedule slot, weekly
  recurrence over the lecture period, exams as single events).
- `[?]` Lecture period start/end dates per semester are needed for the recurrence
  rule — decide source (hardcoded per-semester table vs. DB).
- Optional later: subscription URL (webcal). Out of scope for the first pass.

### 5.7 Mobile planner
- The weekly grid is **no longer optional** — it must render usefully on all screen
  sizes (320px up). Font sizes and block content scale down accordingly.
- Course blocks on small screens show only the **course name + lecture/exercise
  tag**. Room and professor appear when tapping the block (detail view).
- Adding courses on mobile: the user taps **into the plan** — tapping an **empty
  slot** opens the add flow (interested list / course picker). There is no
  permanently visible add-panel on mobile.

Acceptance:
- Fresh load shows the current semester, auto-saved, no delete button, no draft
  banners, progress strip with live delta on top.
- Desktop shows plan + Interested panel; mobile shows a usable grid where empty
  slots add and filled slots open details.
- ICS export downloads a valid file that imports into Google/Apple/Outlook calendar.

---

## WP6 — Overview (Dashboard) cleanup `[FE]`

- Remove the **"Study areas explained"** section
  (`shared/components/RegulationAreasInfo.tsx`, rendered under the regulation
  progress in `RegulationProgress.tsx`/`Dashboard.tsx`). Delete the component if
  nothing else uses it.

---

## Cross-cutting rules

- Visual reference stays `StudyOS.html` — reuse its colors, typography, spacing.
- Every change must work at 320px, 375px, 768px, desktop; light and dark mode.
- Information that does not exist is not rendered (except the Moodle/Ilias slot,
  WP4.2).
- New pure logic (offering status, title cleaning, ICS generation, time filters)
  goes into testable utilities under the matching feature with unit tests in
  `frontend/tests/`.
- Run `npm run lint`, `npm run build`, `npm run test:frontend` per work package.

## Resolved decisions (formerly open questions)

1. **WP2 — compulsory modules:** identified through the examination regulations
   (regulation mapping: mandatory study-area options), no extra DB flag.
2. **WP2 — dedup key:** course numbers are unique and stable across periods; use
   them as the dedup key. Numbers are otherwise irrelevant to users — show the
   course number only in the detail view, nowhere else.
3. **WP3.4 — time filters:** exact day and time filters (pick weekday(s) and a
   concrete time range), evaluated against the course schedule slots.
4. **WP5.6 — lecture period dates:** derived by rule, no DB table needed.
   Lecture periods always start in the second week of April (summer) / October
   (winter) and end late July / late February. Anchor (SoSe 2026):
   start Monday 2026-04-13, end Saturday 2026-07-25. Rule used for all
   semesters: start = second Monday of April/October, end = last Saturday of
   July (summer) / last Saturday of February (winter). Implement as a pure
   utility that computes past and future semesters from this rule.
5. **WP4.2 — Moodle/Ilias links:** will live in a dedicated table mapping a
   course directly to a link. Create the table now (migration, empty); the
   backend exposes the link when present, the UI shows the explicit
   "not available" state until the table is filled.
