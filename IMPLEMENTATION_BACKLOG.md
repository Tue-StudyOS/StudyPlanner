# Implementation Backlog

Tracked upcoming implementation work for StudyPlanner.

Scope: transcript import reliability, semester-completion workflows, Bachelor Informatik intermediate-exam visibility, mobile/desktop compatibility, responsive agent rules, and catalog test data.

Use the current shared implementation branch unless a later review decides to split work. Keep one focused commit per group. Do not commit local test PDFs or generated artifacts.

---

## Status legend

| Symbol | Meaning |
| --- | --- |
| `[ ]` | Open |
| `[~]` | In progress |
| `[x]` | Done |
| `[!]` | Blocked |

---

## Current safeguards

- [ ] Keep the local German Transcript of Records PDF uncommitted.
  - Current local fixture: `Tischberger_Ben_ToR_2026-05-08.pdf`
  - Use it only for manual parser verification.
  - Do not commit the PDF, screenshots of it, or extracted personal data.
  - If automated tests need fixtures, create anonymized text fixtures instead of using the real PDF.

- [ ] Keep existing unrelated local changes out of implementation commits.
  - Current unrelated modified file: `einzupflegene_po/msc_machine_learning_po2021.json`
  - Review it separately before staging anything.

---

## Group A — German Transcript of Records import support

**Recommended commit:** `fix: support German transcript imports`
**Primary files:** `frontend/src/features/transcript/utils/parseTranscriptPdf.ts`, `frontend/src/features/transcript/utils/buildTranscriptImportCandidates.ts`, `frontend/src/features/transcript/components/Transcript.tsx`, transcript import types/tests or fixtures if added

- [x] **A-1 Audit current English-only parser assumptions**
  - Identify all labels, status texts, column headers, and date/grade formats that currently work only for the English ToR.
  - Compare them against the local German ToR fixture without committing that file.

- [x] **A-2 Add German ToR field recognition**
  - Support German labels for course/module names, ECTS/credits, grades, semester/date, attempts, and completion status.
  - Recognize German completion states such as passed/credited equivalents and ignore failed or unfinished rows.
  - Keep parser logic language-tolerant instead of branching into two unrelated parsers.

- [x] **A-3 Normalize grades, ECTS, and semester labels consistently**
  - Accept German decimal commas and English decimal dots where they appear.
  - Preserve the official ToR grade scale validation.
  - Map German semester/date values into the existing completed-course shape.

- [x] **A-4 Keep review behavior unchanged**
  - German imports should produce the same review candidates as English imports.
  - Valid German rows should be importable without manual re-entry.
  - Unmatched rows should remain visible for review instead of being dropped silently.

- [x] **A-5 Add safe parser validation**
  - Add anonymized fixture-based tests if a lightweight test path exists.
  - Otherwise document a manual smoke checklist using the local uncommitted German PDF.
  - Verify English ToR import still works after the German changes.

---

## Group B — Mark semester-plan courses as completed

**Recommended commit:** `feat: complete planned semester courses`
**Primary files:** `frontend/src/features/planner/components/SemesterPlanner.tsx`, `frontend/src/features/planner/hooks/useSemesterPlanner.ts`, `frontend/src/features/transcript/components/TranscriptProvider.tsx`, `frontend/src/features/transcript/api.ts`, `backend/src/services/user_completed_courses.py` if a backend helper endpoint is needed

- [x] **B-1 Define the completion flow from the planner**
  - Add an explicit action such as `Mark semester as completed` for a saved semester plan.
  - Let users choose all planned courses or selected courses from that semester.
  - Require sign-in and show a clear message if the user is signed out.

- [x] **B-2 Convert planned catalog courses into completed-course records**
  - Use catalog course title, course number, ECTS, and regulation/study-area assignment where available.
  - Use the selected semester label as the completed-course semester.
  - Keep grades optional so users can mark courses complete even before entering exact grades.

- [x] **B-3 Prevent duplicates and conflicting assignments**
  - Detect already completed planned courses and skip or explain them.
  - Reuse existing duplicate logic from transcript import/completed-course persistence.
  - If a course can count toward multiple regulation areas, require the user to choose before saving.

- [x] **B-4 Provide confirmation and undo-safe feedback**
  - Show a confirmation before writing multiple completed courses.
  - Show imported/skipped/needs-attention results after saving.
  - Refresh transcript, dashboard, favorites/planner completion badges, and progress state after success.

- [x] **B-5 Keep the flow usable on phone and desktop**
  - The selection UI must not overflow on narrow screens.
  - Sticky or bottom actions must stay reachable with mobile browser chrome and safe areas.

---

## Group C — Bachelor Informatik intermediate-exam requirement visibility

**Recommended commit:** `feat: show Bachelor Informatik intermediate exam status`
**Primary files:** `backend/src/services/progress.py`, `backend/src/services/regulations.py` if needed, `frontend/src/features/dashboard/components/Dashboard.tsx`, `frontend/src/features/dashboard/components/RegulationProgress.tsx`, `frontend/src/features/dashboard/types.ts`, `frontend/src/features/dashboard/api.ts`

- [ ] **C-1 Confirm the exact PO 2021 rule and course set**
  - Verify the Bachelor Informatik `Zwischenprüfung` requirement from the official PO/source data.
  - Confirm whether the rule is one passed course from the four math mandatory modules, one passed course from the four practical-informatics mandatory lectures, or another exact combination.
  - Record the exact course numbers/module identifiers used for matching.

- [ ] **C-2 Add backend progress evaluation**
  - Evaluate the rule only for Bachelor Informatik users with the relevant regulation version.
  - Match completed courses by catalog course id, course number, external course code, and/or module mapping where safe.
  - Consider the requirement fulfilled as soon as any qualifying completed course satisfies the confirmed rule.

- [ ] **C-3 Show the warning only when useful**
  - Display it on the dashboard only if the user is affected and the requirement is not fulfilled.
  - Include the deadline context: completion by the end of the 4th semester.
  - If the current semester is unknown, show neutral guidance instead of an alarming warning.

- [ ] **C-4 Make the missing requirement actionable**
  - Show which qualifying course groups can satisfy the requirement.
  - Link or guide users to catalog/planner actions where practical.
  - Hide the card automatically once the requirement is fulfilled.

- [ ] **C-5 Validate edge cases**
  - Bachelor Informatik user without completed courses.
  - Bachelor Informatik user with qualifying math course.
  - Bachelor Informatik user with qualifying practical-informatics course.
  - Non-Bachelor Informatik users should never see the warning.

---

## Group D — Responsive rules in agent guidance

**Recommended commit:** `docs: require responsive frontend guardrails`
**Primary files:** `AGENTS.md`, `agents/frontend-architect.md`, `.claude/skills/frontend/SKILL.md` if kept, possibly `CLAUDE.md`

- [ ] **D-1 Add a non-negotiable responsive rule**
  - Every new frontend feature must work on phone and desktop.
  - No new feature may introduce horizontal overflow, clipped cards, cut-off modals, or unreachable buttons.

- [ ] **D-2 Define mobile-first implementation checks**
  - Prefer flexible widths: `w-full`, `max-w-full`, `min-w-0`, wrapping, and responsive grids.
  - Avoid fixed widths unless paired with safe max widths and intentional overflow handling.
  - Ensure long course names, German labels, and email/user text wrap or truncate safely.

- [ ] **D-3 Define required viewport checks**
  - Check at least narrow phone, common phone, tablet, and desktop widths.
  - Include safe-area and mobile browser chrome behavior for sticky headers, bottom bars, drawers, and modals.

- [ ] **D-4 Keep agent docs aligned**
  - Remove stale or contradictory frontend instructions while adding the responsive guardrails.
  - If `.claude/skills/frontend/SKILL.md` is kept, make it match the current StudyPlanner app and project structure.

---

## Group E — Cross-feature mobile and desktop compatibility pass

**Recommended commit:** `fix: improve responsive layout across features`
**Primary files:** frontend feature components, shared components, `frontend/src/index.css`

- [ ] **E-1 Audit global layout and navigation**
  - Check `Layout`, `TopBar`, navigation, page containers, dark/light themes, and safe-area behavior.
  - Fix any remaining horizontal scroll, clipped content, or unstable sticky elements.

- [ ] **E-2 Audit catalog and course detail views**
  - Course cards, filters/search, detail drawer/page, badges, schedules, lecturer lists, and long titles must wrap correctly.
  - Multi-tag courses must remain readable on phone and desktop.

- [ ] **E-3 Audit dashboard and progress views**
  - Summary cards, regulation progress, specialization/radar visualization, completed-course lists, and new intermediate-exam warning must fit small screens.
  - Charts should scale without cutting labels or markers.

- [ ] **E-4 Audit transcript import and manual completion views**
  - Upload card, import review rows, catalog picker, manual completed-course form, grade select, and issue lists must be usable on phone.
  - German ToR labels and longer German text must not break layouts.

- [ ] **E-5 Audit semester planner**
  - Planner grid/list modes, favorites panel, completion action, assignment controls, conflict feedback, and hidden-slot controls must stay usable on narrow screens.
  - Prefer a mobile list layout where a desktop grid would overflow.

- [ ] **E-6 Audit account, onboarding, favorites, and shared components**
  - Forms, modals, notices, buttons, badges, icons, and cards must have accessible spacing and touch targets.
  - No text or action buttons should be cut off at common mobile widths.

- [ ] **E-7 Add a manual responsive smoke checklist**
  - Test at 320px, 375px, 768px, 1024px, and desktop width.
  - Test both light and dark mode.
  - Test with long German labels and long course names.

---

## Group F — Multi-tag catalog test courses

**Recommended commit:** `testdata: add multi-tag catalog courses`
**Primary files:** D1 seed/migration files, catalog service if sorting/pinning is needed, progress/category seed mapping, regulation mapping seed data if required

- [x] **F-1 Decide the test-data storage path**
  - Added via `0019_testdata_multi_tag_courses.sql` migration — reversible, not mixed into ALMA data.
  - Titles prefixed "000 Test Course", source_note "Test data — non-official.", scrape_run source_url `test://testdata/multi-tag-catalog-2025`.
  - Removable without side effects: `DELETE FROM scrape_runs WHERE source_url = 'test://testdata/multi-tag-catalog-2025'` cascades all rows.

- [x] **F-2 Add eight stable test courses**
  - Numbers `INFO0001-TEST` … `INFO0008-TEST` — pass the catalog filter (`INFO%`) and sort before all real `INFO4xxx` entries.
  - unit_ids `TEST-001` … `TEST-008` are entirely outside the ALMA range.
  - Visible in catalog list (top position) and detail views; ECTS=6 derived from linked curriculum modules.

- [x] **F-3 Give each course interesting multi-tag combinations**
  - Each course has a distinct masterCat combination: 1 single-tag, 3 two-tag, 4 three-tag courses.
  - All 10 progress categories covered across the 8 courses; no two courses share the same masterCat set.
  - Isolated to test study program `TEST_DEMO_2025` — no overlap with real regulation mappings.

- [x] **F-4 Suggested test course set**
  - All 8 courses from the backlog implemented; progress categories match the described combinations.
  - masterCat tags: 01 TECH+PRAK, 02 TECH+PRAK+INFO, 03 THEO+PRAK, 04 INFO+BASIS, 05 THEO+INFO+BASIS, 06 TECH+THEO+INFO, 07 PRAK, 08 TECH+THEO+INFO.

- [x] **F-5 Make top-of-catalog ordering explicit**
  - Deterministic: `INFO0001-TEST` sorts before `INFO4193` via the existing SQL CASE+number ASC rule; no extra code needed.
  - Real catalog ordering is unchanged.

- [x] **F-6 Protect progress correctness**
  - Test courses mapped only to `TEST_DEMO_2025` (a non-official study program not matching any user's regulation).
  - `course_progress_category_mappings` rows use `regulation_version_id = NULL` and a clear source_note.
  - Completing a test course will show it in the radar chart only once explicitly marked complete; it contributes 0 ECTS to any real regulation area.

---

## Group G — End-to-end validation before implementation handoff

**Recommended commit:** include validation notes in the relevant group commits, not as a separate code-only commit unless docs are changed

- [ ] **G-1 Build and lint**
  - Run `npm --prefix frontend run build`.
  - Run lint/typecheck commands if available.

- [ ] **G-2 Transcript import smoke tests**
  - English ToR still imports correctly.
  - German ToR local fixture imports correctly.
  - Unmatched rows stay visible for review.

- [ ] **G-3 Authenticated user-flow smoke tests**
  - Mark semester plan as completed.
  - Completed courses persist and update dashboard/progress.
  - Duplicate detection works.

- [ ] **G-4 Dashboard smoke tests**
  - Bachelor Informatik intermediate-exam warning appears only when incomplete and relevant.
  - Warning disappears after a qualifying course is completed.

- [ ] **G-5 Responsive smoke tests**
  - Phone, tablet, and desktop widths.
  - Light and dark mode.
  - Long German labels, long course names, and multi-tag catalog cards.

---

## Notes

- Do not commit `Tischberger_Ben_ToR_2026-05-08.pdf`.
- Do not commit `.pi/`, Wrangler state, generated SQL dumps, build outputs, or `node_modules`.
- Use the frontend architect guidance before implementing React/TypeScript changes.
- Ask before adding production dependencies.
