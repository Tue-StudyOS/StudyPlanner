# Planner Balance Local QA Report

## Test Setup

- Frontend: `http://localhost:5173/`
- Worker API: `http://localhost:8787/health` returned D1 reachable with 41 tables.
- Test users: disposable local accounts with `planner-balance-*@local.test`.
- Local-only fixture courses were inserted into Wrangler D1 and removed after testing:
  - `990001` QA Balance PRAK Lecture -> `INFO-PRAK`
  - `990002` QA Balance TECH Lecture -> `INFO-TECH`
  - `990003` QA Balance FOKUS Lecture -> `INFO-FOKUS`
  - `990004` QA Balance BASIS Lecture -> `INFO-BASIS`
  - `990005` QA Balance Multi PRAK TECH FOKUS Lecture -> `INFO-PRAK`, `INFO-TECH`, `INFO-FOKUS`
  - `990006` QA Balance Multi TECH INFO Lecture -> `INFO-TECH`, `INFO-INFO`
- The in-app browser tool failed to start in this sandbox, so the UI pass used temporary headless Chrome against the real local frontend. The headless Chrome process was stopped after testing.

## Backend/API Results

| Case | Expected | Observed | Result |
| --- | --- | --- | --- |
| `978 + 1006`, no completed ECTS, no preferences | Split between `INFO-THEO` and `INFO-INFO` | Both assigned to `INFO-THEO` | Fail |
| `978 + 1006`, both preferred as `INFO-INFO` | Balance should override pile-up when a split is better | Both stayed in `INFO-INFO` | Fail |
| `INFO-INFO = 18`, planned `978 + 1006` | Both move to `INFO-THEO` | Both assigned to `INFO-THEO` | Pass |
| `INFO-THEO = 18`, `INFO-INFO = 9`, planned `978 + 1006` | One assigned to `INFO-INFO`, one unassigned | `978 -> INFO-INFO`, `1006` unassigned with `capacity_unassigned` | Pass |
| `INFO-THEO = 9`, `INFO-INFO = 9`, planned `978 + 1006` | Split remaining slots | `978 -> INFO-THEO`, `1006 -> INFO-INFO` | Pass |
| Both compatible areas full, planned `978` | Unassigned with capacity warning | Unassigned with `capacity_unassigned` | Pass |
| Unknown course ID | `unknown_course` warning and unassigned | Warning returned, but `strictSolutionFound: true` | Partial fail |
| Existing unmapped course `982` | `unmapped_course` warning and unassigned | Warning returned, but `strictSolutionFound: true` | Partial fail |
| Duplicate IDs `[978, 978, 1006]` | Deduped | Deduped | Pass |
| Synthetic single-label courses | Assign each exact label | PRAK, TECH, FOKUS, BASIS assigned correctly | Pass |
| Synthetic multi-label empty capacity | Use compatible labels | `990005 -> INFO-PRAK`, `990006 -> INFO-TECH` | Pass |
| Synthetic multi-label with `INFO-TECH` full | Avoid full TECH | `990005 -> INFO-PRAK`, `990006 -> INFO-INFO` | Pass |
| Save invalid assignment `964 -> INFO-THEO` | Reject incompatible area | HTTP 400 planner assignment error | Pass |
| Save/reload valid split assignment | Persist exact assignments | Reload returned saved assignments | Pass |

Important API findings:

- The backend still has the original balance-quality bug: when areas are equally open, it prefers lower `sort_order` instead of spreading courses.
- Existing assignment preferences are too strong for a button named Balance planner.
- `strictSolutionFound` is misleading for unknown/unmapped-only inputs because the searchable course set is empty. A response can contain warnings and unassigned courses while still reporting `strictSolutionFound: true`.

## UI Button-Flow Results

Tested through the real Planner page with a fresh local account and explicit `QA-UI-2026` semester selection.

Working behavior:

- Before edit mode, `Balance planner` and favorite `Add` buttons are disabled.
- In edit mode with an empty plan, `Balance planner` stays disabled and favorite `Add` buttons become enabled.
- Adding `978` and `1006` shows an unsaved draft and enables `Balance planner`.
- Save persists assignments; reload keeps the saved plan.
- Remove followed by Cancel restores the saved plan.
- In an impossible capacity case (`INFO-THEO = 18`, `INFO-INFO = 9`, planned `978 + 1006`), Balance planner showed the warning `No compatible regulation area has enough remaining ECTS capacity.` and kept one course in `Needs assignment`.

Problem behavior:

- Add-time frontend suggestions already split `978` and `1006` before Balance planner is pressed. This can mask backend balancing bugs and confirms automatic suggestions are being treated as assignment state.
- When both ambiguous courses were manually changed to `INFO-INFO`, pressing Balance planner kept both in `INFO-INFO`. This reproduces the preference-over-balance problem through the UI.
- Synthetic high-ID QA courses were visible through direct catalog detail and usable through the balance API, but they did not appear in the Planner favorites panel. The planner uses a broad catalog list (`useCatalogCourses('', 500)`), so local high-ID fixtures outside that result window are not available to add from the UI.

## Algorithm Optimization Plan

### 1. Make the backend objective explicit

Update `_score_solution` so the ordering is:

1. Maximize assigned planned courses.
2. Minimize unassigned ECTS, not only unassigned count.
3. Prefer assignments that fill remaining required/capacity gaps across compatible areas.
4. Prefer balanced distribution, for example by minimizing the maximum fill ratio and then minimizing variance/squared deviation across relevant areas.
5. Preserve valid user preferences only after the balance-quality score is equal.
6. Use `sort_order`, area code, and course id only as deterministic final tie-breakers.

This should make `978 + 1006` split across `INFO-THEO` and `INFO-INFO` when both areas are open, and prevent a pair of preferences from forcing a worse balanced result.

### 2. Separate assignment sources in frontend state

- Do not store add-time suggestions in `planAssignments`.
- Treat `planAssignments` as explicit user choices or backend Balance planner output.
- Keep lightweight suggestions derived for display only.
- If source tracking is needed, add local metadata such as `assignmentSource: manual | balanced`, but do not persist it unless the product needs it.

### 3. Align frontend display with backend rules

- Replace `PlannerFeedback`'s greedy per-course display resolver with a plan-level resolver that uses the same scoring priorities as the backend.
- Or, after Balance planner is clicked, render the backend returned assignments as authoritative and keep unassigned returned courses in `Needs assignment`.
- Use `studyAreaOptions[].ectsCounted` for frontend planned ECTS calculations when available, matching backend mapping ECTS.

### 4. Fix result semantics

- Rename or redefine `strictSolutionFound` so it is false whenever any requested course is unknown, unmapped, or capacity-unassigned.
- Optionally return separate booleans:
  - `allSearchableCoursesAssigned`
  - `allRequestedCoursesAssigned`
  - `hasWarnings`

### 5. Add regression coverage

- Add backend service-level tests for the exact cases in this report.
- Add a frontend integration test for:
  - add two ambiguous courses;
  - press Balance planner;
  - manually force both to one area;
  - press Balance planner again;
  - impossible capacity keeps one course in `Needs assignment`.
- If adding a browser test dependency is not acceptable, keep a small local CDP smoke-test script documented outside production code.

## Follow-Up Recommendation

Fix the backend score first, then remove frontend auto-suggestion persistence. These two changes should address the main visible behavior without changing the database schema or adding production dependencies.
