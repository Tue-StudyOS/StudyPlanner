# Implementation Backlog

Tracked upcoming frontend changes for the StudyPlaner app.
Focus: remaining UX fixes for transcript import, mobile header stability, and specialization-profile polish for phone and desktop users.
Each group = one dedicated branch. Prefer one focused feature/fix commit per group when practical; combine only tightly related changes. Branch name: `fix/<group-slug>` or `feat/<group-slug>`.

---

## Status legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Open |
| `[~]` | In progress |
| `[x]` | Done |
| `[!]` | Blocked |

---

## Group A — Transcript import review must stay visible until the user acts

**Branch:** `fix/transcript-import-review-persistence`
**Files:** `frontend/src/features/transcript/components/Transcript.tsx`, `frontend/src/features/transcript/components/TranscriptImportRow.tsx`, `frontend/src/features/transcript/components/TranscriptUploadCard.tsx`, transcript import helpers if needed

- [x] **A-1** Stop auto-clearing freshly parsed transcript rows
  - Keep parsed Transcript of Records import candidates visible after upload instead of letting them disappear immediately
  - Only remove a row after an explicit user action such as import, discard, or reset

- [x] **A-2** Replace the implicit import jump with an explicit review/confirm step
  - Let users inspect valid rows before they are persisted
  - Keep the primary import action obvious and usable on both phone and desktop

- [x] **A-3** Preserve unfinished review state safely
  - Keep in-progress import candidates stable across refreshes and route changes
  - Avoid silent loss, duplication, or unexpected merging when saved transcript issues are reloaded

- [x] **A-4** Clarify post-import feedback
  - Show what was imported successfully and what still needs attention
  - Keep unresolved rows accessible until the user resolves or discards them

---

## Group B — Mobile top-bar blocker must stay visually closed while scrolling

**Branch:** `fix/mobile-topbar-overscroll-gap`
**Files:** `frontend/src/features/layout/components/TopBar.tsx`, `frontend/src/features/layout/components/Layout.tsx`, `frontend/src/index.css`

- [x] **B-1** Remove the white gap above the dark mobile header during aggressive scrolling
  - Keep the dark top blocker visually continuous during fast up/down swipes
  - Preserve the already-correct reload behavior

- [x] **B-2** Recheck sticky-header and safe-area behavior on mobile browsers
  - Validate the fix against browser chrome collapse/expand and overscroll behavior
  - Avoid regressions for desktop spacing, sticky positioning, and the mobile menu overlay

---

## Group C — Specialization Profile light-mode contrast and marker polish

**Branch:** `fix/specialization-profile-light-mode-polish`
**Files:** `frontend/src/features/dashboard/components/SpecializationCircle.tsx`, `frontend/src/features/dashboard/visualizationCategories.ts`, `frontend/src/index.css`

- [x] **C-1** Strengthen the weaker light-mode category highlights
  - Increase the visible color strength for `Software Eng.`, `Cloud Dev`, and `Vision`
  - Keep category contrast balanced without making dark mode harsher than necessary

- [x] **C-2** Make the specialization point markers slightly smaller
  - Reduce the marker size by about 5%
  - Keep them readable on both compact mobile screens and desktop

- [x] **C-3** Replace the neutral gray marker fallback with the existing gold accent
  - Reuse the established gold highlight color instead of a separate gray tone
  - Apply the change consistently wherever the weaker/default markers are rendered

- [x] **C-4** Slightly darken the radar grid in light mode
  - Increase grid and spoke contrast just enough to read better on bright screens
  - Keep dark-mode grid contrast unchanged unless a matching adjustment is required for consistency

---

## Backlog notes

- Prioritize functional fixes before visual polish: Group A → Group B → Group C.
- Re-run transcript import smoke tests on phone and desktop after Group A.
- Recheck iOS and Android scroll behavior after Group B.
- Compare light-mode and dark-mode dashboard screenshots before shipping Group C.
