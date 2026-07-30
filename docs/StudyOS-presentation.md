# StudyOS presentation (English, dark, real app chrome)

**File:** [`StudyOS-presentation.pptx`](./StudyOS-presentation.pptx) · 37 slides · ~15 min  
**Rebuild:** `python scripts/build-studyos-presentation.py`. Run
`node scripts/render-app-chrome.mjs` first only when the chrome (top bar / log page)
changes, `node scripts/render-tool-logos.mjs` only when tool logos change.  
**Google Slides:** upload to Drive → *Open with → Google Slides*.

## Design

- The top bar is the **real UI**, rendered at 3x from the production markup and
  dark-mode tokens (TopBar.tsx + index.css) into `docs/app-chrome/topbar-*.png`.
  Logo glyph embedded, theme-toggle + gear buttons like production. One PNG per
  section, the active pill moves while flipping.
- Nav sections mirror the grading rubric: Problem · Students · Product · Build ·
  Iterate · Demo · Future · Try it. Every rubric opens with a divider (stop) slide;
  content headings are plain "Section - Title" (simple hyphen, one weight, no two-tone).
- No muted italic asides; those points are spoken. No shadows on any shape.
- Footer on framed slides (not full-bleed shots): "StudyOS Practical - P. Gehler -
  July 2026" far left, slide number white in a small quieter brand-red box bottom right.
  Drop shadows are stripped from every shape (theme inherit is not enough).
- Architecture diagram is dark-native (rebuilt with GPT/MCP lane) and matches the deck.
  Editable source: `pipeline.drawio`. Regenerate PNG:
  `node scripts/render-architecture-diagram.mjs`.
- Tool logos: Claude, Cursor (Simple Icons), Pi (official pi.dev mark), Codex (framed
  `>_` app icon). Regenerate: `node scripts/render-tool-logos.mjs`.
- Journey: whole original screenshots, full slide, no chrome, no labels, clicked fast.
  Compass v1 removed. Beta before current prod, prod closes.
- Quotes: calm two-column layout, tiny alternating tilt.
- Links via shape click actions (no blue styling). "Live demo" itself is clickable.

## Structure

| Section | Slides (each section starts with its divider) |
|---------|--------|
| — | title, full team (Ben, Yonatan, Emre, Lena) |
| Problem | pains + explicit X / Y / Z card (course convention) |
| Students | quotes: wishes and what they use today |
| Product | divider carries logo glyph · feature grid · degree programs (two boxes: Bachelor 180 / Master 120, intro line in normal color) |
| Build | data flow (dark diagram incl. MCP/GPT) · Cloudflare · how we worked (Claude, Cursor, Codex, Pi) · StudyOS Bot |
| Iterate | divider shows the double diamond (plan → implement) · 10 shots · mid-way feedback quotes · 4 shots · "many more changes" · what we fixed · today |
| Demo | "Live demo", clickable, nothing else |
| Future | divider · log + Codex automation stacked on one slide · Fachschaft / Erstiheft separate |
| Try it | link + clickable QR (last) |

## Assets

- `docs/app-chrome/` topbars + log page (Playwright render, real markup)
- `docs/tool-logos/` claude/cursor (Simple Icons), π glyph, ">_ Codex" wordmark
  (Codex has no separate logo asset; OpenAI brands it with the terminal prefix)
- `docs/cloudflare-logo.png` (Wikimedia), `docs/StudyOS-architecture-diagram.png`
  (from the old deck), `docs/erstiheft-crop.png` (perspective-corrected photo)

## Verified facts on slides (from code, Jul 2026)

- PO 2021, official sources, six programs, everything works for all of them:
  Bachelor 180 ECTS (Informatik, Bio-, Medien-, Medizininformatik), Master 120 ECTS
  (Informatik, Machine Learning).
- Catalog: 1,158 courses, 9 semesters, SoSe 2022 → SoSe 2026.
- MCP: `studyplaner.pages.dev/mcp`, read-only, no auth.
- GPT: chatgpt.com/g/g-6a2de082a0b88191b833f7307d0c9429-studyos-bot
- Infra: Cloudflare Pages + Workers + D1 (SQLite), auto deploy on merge, config check in CI.

## Speaker split (~15 min)

- **Ben:** Problem, Students, Product, Iterate, Demo
- **Yonatan:** Build (data, Cloudflare, AI workflow, GPT), Future
- Both: title + Try it

## Swap later

New screenshots → `docs/presentation-iteration-shots/dark-uniform/`, same names,
rerun the build script. Changing sections/nav → rerun `render-app-chrome.mjs` too.
Footer date lives in the `FOOTER` constant of the build script.
